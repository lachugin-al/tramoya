import express from 'express';
import request from 'supertest';
import bodyParser from 'body-parser';
import {MinioService} from '../../../src/services/minio-service';
import {RedisService} from '../../../src/services/redis-service';
import {QueueService, QUEUE_NAMES, JobType} from '../../../src/services/queue-service';
import testRoutes from '../../../src/routes/test-routes';
import {TestScenario, TestStepType} from '../../../src/models/test-scenario';
import {TestStatus} from '../../../src/models/test-result';

// Mock dependencies
jest.mock('../../../src/services/minio-service');
jest.mock('../../../src/services/redis-service');
jest.mock('../../../src/services/queue-service');

describe('Test Routes', () => {
    let app: express.Application;
    let mockMinioService: jest.Mocked<MinioService>;
    let mockRedisService: jest.Mocked<RedisService>;
    let mockQueueService: jest.Mocked<QueueService>;
    let testScenarioId: string;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create mock instances
        mockMinioService = new MinioService() as jest.Mocked<MinioService>;
        mockRedisService = new RedisService() as jest.Mocked<RedisService>;
        mockQueueService = new QueueService(mockRedisService) as jest.Mocked<QueueService>;

        // Setup mock implementations
        mockRedisService.subscribe = jest.fn().mockImplementation((channel, callback) => {
            // Store callback for later use in tests
            (mockRedisService as any).subscriptionCallback = callback;
        });

        mockQueueService.addJob = jest.fn().mockResolvedValue({id: 'job-123'});

        // Create Express app
        app = express();
        app.use(bodyParser.json());
        app.use('/tests', testRoutes(mockMinioService, mockRedisService, mockQueueService));
    });

    describe('GET /tests', () => {
        it('should return an empty array when no tests exist', async () => {
            const response = await request(app).get('/tests');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });
    });

    describe('POST /tests', () => {
        it('should create a new test scenario', async () => {
            const testData = {
                name: 'Test Login Flow',
                description: 'Verify user can log in successfully',
                steps: [
                    {
                        type: TestStepType.NAVIGATE,
                        url: 'https://example.com/login'
                    },
                    {
                        type: TestStepType.INPUT,
                        selector: '#username',
                        text: 'testuser'
                    },
                    {
                        type: TestStepType.INPUT,
                        selector: '#password',
                        text: 'password123'
                    },
                    {
                        type: TestStepType.CLICK,
                        selector: '#login-button'
                    },
                    {
                        type: TestStepType.ASSERT_TEXT,
                        selector: '.welcome-message',
                        text: 'Welcome, Test User',
                        exactMatch: false
                    }
                ]
            };

            const response = await request(app)
                .post('/tests')
                .send(testData);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                name: testData.name,
                description: testData.description,
                steps: expect.arrayContaining([
                    expect.objectContaining({type: TestStepType.NAVIGATE}),
                    expect.objectContaining({type: TestStepType.INPUT, selector: '#username'}),
                    expect.objectContaining({type: TestStepType.INPUT, selector: '#password'}),
                    expect.objectContaining({type: TestStepType.CLICK}),
                    expect.objectContaining({type: TestStepType.ASSERT_TEXT})
                ])
            });

            // Store the ID for later tests
            testScenarioId = response.body.id;
        });

        it('should return 400 if name is missing', async () => {
            const response = await request(app)
                .post('/tests')
                .send({
                    description: 'Test without name'
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({error: 'Test name is required'});
        });

        it('should return 400 if steps is not an array', async () => {
            const response = await request(app)
                .post('/tests')
                .send({
                    name: 'Invalid Test',
                    steps: 'not an array'
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({error: 'Steps must be an array'});
        });
    });

    describe('GET /tests/:id', () => {
        it('should return a specific test scenario', async () => {
            // First create a test
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test to Retrieve',
                    description: 'This test will be retrieved'
                });

            const id = createResponse.body.id;

            // Then retrieve it
            const getResponse = await request(app).get(`/tests/${id}`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body).toEqual(createResponse.body);
        });

        it('should return 404 if test scenario is not found', async () => {
            const response = await request(app).get('/tests/nonexistent-id');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({error: 'Test scenario not found'});
        });
    });

    describe('PUT /tests/:id', () => {
        it('should update an existing test scenario', async () => {
            // First create a test
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Original Test',
                    description: 'This test will be updated',
                    steps: [
                        {
                            type: TestStepType.NAVIGATE,
                            url: 'https://example.com'
                        }
                    ]
                });

            const id = createResponse.body.id;

            // Then update it
            const updateData = {
                name: 'Updated Test',
                description: 'This test has been updated',
                steps: [
                    {
                        type: TestStepType.NAVIGATE,
                        url: 'https://example.com/updated'
                    },
                    {
                        type: TestStepType.CLICK,
                        selector: '#new-button'
                    }
                ]
            };

            const updateResponse = await request(app)
                .put(`/tests/${id}`)
                .send(updateData);

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body).toMatchObject({
                id,
                name: updateData.name,
                description: updateData.description,
                steps: expect.arrayContaining([
                    expect.objectContaining({type: TestStepType.NAVIGATE, url: 'https://example.com/updated'}),
                    expect.objectContaining({type: TestStepType.CLICK, selector: '#new-button'})
                ])
            });
        });

        it('should return 404 if test scenario to update is not found', async () => {
            const response = await request(app)
                .put('/tests/nonexistent-id')
                .send({
                    name: 'Updated Test'
                });

            expect(response.status).toBe(404);
            expect(response.body).toEqual({error: 'Test scenario not found'});
        });
    });

    describe('DELETE /tests/:id', () => {
        it('should delete an existing test scenario', async () => {
            // First create a test
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test to Delete',
                    description: 'This test will be deleted'
                });

            const id = createResponse.body.id;

            // Then delete it
            const deleteResponse = await request(app).delete(`/tests/${id}`);

            expect(deleteResponse.status).toBe(204);

            // Verify it's gone
            const getResponse = await request(app).get(`/tests/${id}`);
            expect(getResponse.status).toBe(404);
        });

        it('should return 404 if test scenario to delete is not found', async () => {
            const response = await request(app).delete('/tests/nonexistent-id');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({error: 'Test scenario not found'});
        });
    });

    describe('POST /tests/:id/execute', () => {
        it('should queue a test for execution', async () => {
            // First create a test
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test to Execute',
                    description: 'This test will be executed',
                    steps: [
                        {
                            type: TestStepType.NAVIGATE,
                            url: 'https://example.com'
                        }
                    ]
                });

            const id = createResponse.body.id;

            // Then execute it
            const executeResponse = await request(app).post(`/tests/${id}/execute`);

            expect(executeResponse.status).toBe(202);
            expect(executeResponse.body).toMatchObject({
                message: 'Test execution started',
                resultId: expect.any(String),
                result: expect.objectContaining({
                    testId: id,
                    status: TestStatus.RUNNING
                })
            });

            // Verify job was added to queue
            expect(mockQueueService.addJob).toHaveBeenCalledWith(
                QUEUE_NAMES.TEST_EXECUTION,
                JobType.EXECUTE_TEST,
                expect.objectContaining({
                    testId: id,
                    runId: executeResponse.body.resultId,
                    testScenario: expect.any(Object)
                })
            );
        });

        it('should return 404 if test scenario to execute is not found', async () => {
            const response = await request(app).post('/tests/nonexistent-id/execute');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({error: 'Test scenario not found'});
        });
    });

    describe('GET /tests/results', () => {
        it('should return test results', async () => {
            // First create and execute a test to generate a result
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test for Results',
                    steps: [{type: TestStepType.NAVIGATE, url: 'https://example.com'}]
                });

            const id = createResponse.body.id;
            await request(app).post(`/tests/${id}/execute`);

            // Then get results
            const resultsResponse = await request(app).get('/tests/results');

            expect(resultsResponse.status).toBe(200);
            expect(Array.isArray(resultsResponse.body)).toBe(true);
            expect(resultsResponse.body.length).toBeGreaterThan(0);
            expect(resultsResponse.body[0]).toMatchObject({
                status: TestStatus.RUNNING
            });
            expect(resultsResponse.body[0]).toHaveProperty('testId');
        });
    });

    describe('GET /tests/results/:id', () => {
        it('should return a specific test result', async () => {
            // First create and execute a test to generate a result
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test for Result Retrieval',
                    steps: [{type: TestStepType.NAVIGATE, url: 'https://example.com'}]
                });

            const id = createResponse.body.id;
            const executeResponse = await request(app).post(`/tests/${id}/execute`);
            const resultId = executeResponse.body.resultId;

            // Then get the specific result
            const resultResponse = await request(app).get(`/tests/results/${resultId}`);

            expect(resultResponse.status).toBe(200);
            expect(resultResponse.body).toMatchObject({
                id: resultId,
                testId: id,
                status: TestStatus.RUNNING
            });
        });

        it('should return 404 if test result is not found', async () => {
            const response = await request(app).get('/tests/results/nonexistent-id');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({error: 'Test result not found'});
        });
    });

    describe('DELETE /tests/results/:id', () => {
        it('should delete a test result', async () => {
            // First create and execute a test to generate a result
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test for Result Deletion',
                    steps: [{type: TestStepType.NAVIGATE, url: 'https://example.com'}]
                });

            const id = createResponse.body.id;
            const executeResponse = await request(app).post(`/tests/${id}/execute`);
            const resultId = executeResponse.body.resultId;

            // Then delete the result
            const deleteResponse = await request(app).delete(`/tests/results/${resultId}`);

            expect(deleteResponse.status).toBe(204);

            // Verify it's gone
            const getResponse = await request(app).get(`/tests/results/${resultId}`);
            expect(getResponse.status).toBe(404);
        });

        it('should return 404 if test result to delete is not found', async () => {
            const response = await request(app).delete('/tests/results/nonexistent-id');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({error: 'Test result not found'});
        });
    });

    describe('Redis event subscription', () => {
        it('should update test result status when RUN_FINISHED event is received', async () => {
            // First create and execute a test to generate a result
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test for Event Updates',
                    steps: [{type: TestStepType.NAVIGATE, url: 'https://example.com'}]
                });

            const id = createResponse.body.id;
            const executeResponse = await request(app).post(`/tests/${id}/execute`);
            const resultId = executeResponse.body.resultId;

            // Verify initial status
            let resultResponse = await request(app).get(`/tests/results/${resultId}`);
            expect(resultResponse.body.status).toBe(TestStatus.RUNNING);

            // Simulate receiving a RUN_FINISHED event
            const event = {
                type: 'RUN_FINISHED',
                runId: resultId,
                status: TestStatus.PASSED,
                video: 'https://example.com/video.webm',
                trace: 'https://example.com/trace.zip',
                ts: Date.now()
            };

            // Call the subscription callback directly
            (mockRedisService as any).subscriptionCallback(JSON.stringify(event));

            // Verify status was updated
            resultResponse = await request(app).get(`/tests/results/${resultId}`);
            expect(resultResponse.body.status).toBe(TestStatus.PASSED);
            expect(resultResponse.body.videoUrl).toBe('https://example.com/video.webm');
            expect(resultResponse.body.traceUrl).toBe('https://example.com/trace.zip');
        });

        it('should update step status when STEP event is received', async () => {
            // First create and execute a test to generate a result
            const createResponse = await request(app)
                .post('/tests')
                .send({
                    name: 'Test for Step Updates',
                    steps: [
                        {id: 'step-1', type: TestStepType.NAVIGATE, url: 'https://example.com'}
                    ]
                });

            const id = createResponse.body.id;
            const executeResponse = await request(app).post(`/tests/${id}/execute`);
            const resultId = executeResponse.body.resultId;

            // Simulate receiving a STEP event
            const event = {
                type: 'STEP',
                runId: resultId,
                stepId: 'step-1',
                status: 'PASSED',
                url: 'https://example.com/screenshot.png',
                ts: Date.now()
            };

            // Call the subscription callback directly
            (mockRedisService as any).subscriptionCallback(JSON.stringify(event));

            // Verify step was updated
            const resultResponse = await request(app).get(`/tests/results/${resultId}`);
            const stepResult = resultResponse.body.stepResults.find((s: any) => s.stepId === 'step-1');

            expect(stepResult).toBeDefined();
            expect(stepResult.status).toBe('PASSED');
            expect(stepResult.screenshots.length).toBe(1);
            expect(stepResult.screenshots[0].url).toBe('https://example.com/screenshot.png');
        });
    });
});