/**
 * Example E2E test demonstrating playwright-relay usage
 */
import { test, expect, storeTestResult } from '../../src';

interface UserData {
  id: number;
  name: string;
  email: string;
}

interface PostData {
  id: number;
  userId: number;
  title: string;
  content: string;
}

test.describe('User and Post Management', () => {
  
  // Test 1: Create user - returns data for dependent tests
  test('should create user', async () => {
    // Simulating API call
    const user: UserData = {
      id: Math.floor(Math.random() * 1000),
      name: 'Test User',
      email: 'test@example.com',
    };
    
    expect(user.id).toBeGreaterThan(0);
    expect(user.name).toBe('Test User');
    
    // Store result for dependent tests
    storeTestResult('should create user', 'passed', user);
  });
  
  // Test 2: Depends on test 1
  /**
   * @depends should create user
   */
  test('should get user details', async ({ relay }) => {
    const user = relay.from<UserData>('should create user');
    
    expect(user.id).toBeGreaterThan(0);
    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
  });
  
  // Test 3: Depends on test 1, returns new data
  /**
   * @depends should create user
   */
  test('should create post for user', async ({ relay }) => {
    const user = relay.from<UserData>('should create user');
    
    // Simulating API call
    const post: PostData = {
      id: Math.floor(Math.random() * 1000),
      userId: user.id,
      title: 'My First Post',
      content: 'Hello World!',
    };
    
    expect(post.userId).toBe(user.id);
    
    // Store result for dependent tests
    storeTestResult('should create post for user', 'passed', post);
  });
  
  // Test 4: Depends on test 3 (which depends on test 1)
  /**
   * @depends should create post for user
   */
  test('should update post', async ({ relay }) => {
    const post = relay.from<PostData>('should create post for user');
    
    // Simulating API call
    const updatedPost: PostData = {
      ...post,
      title: 'Updated Title',
      content: 'Updated content!',
    };
    
    expect(updatedPost.id).toBe(post.id);
    expect(updatedPost.title).toBe('Updated Title');
    
    storeTestResult('should update post', 'passed', updatedPost);
  });
  
  // Test 5: Multiple dependencies
  /**
   * @depends should create user
   * @depends should create post for user
   */
  test('should verify user has post', async ({ relay }) => {
    const user = relay.from<UserData>('should create user');
    const post = relay.from<PostData>('should create post for user');
    
    expect(post.userId).toBe(user.id);
  });
  
  // Test 6: Using require for dynamic dependency
  test('should dynamically require dependency', async ({ relay }) => {
    // This will get the cached result or trigger execution if needed
    const hasRun = relay.hasRun('should create user');
    
    if (hasRun) {
      const user = relay.from<UserData>('should create user');
      expect(user.name).toBe('Test User');
    }
  });
  
  // Test 7: Check status
  /**
   * @depends should create user
   */
  test('should check dependency status', async ({ relay }) => {
    const status = relay.status('should create user');
    expect(status).toBe('passed');
    
    const unknownStatus = relay.status('nonexistent test');
    expect(unknownStatus).toBe('pending');
  });
  
  // Test 8: Get all results
  /**
   * @depends should create user
   * @depends should create post for user
   */
  test('should get all cached results', async ({ relay }) => {
    const all = relay.all();
    
    expect(all.size).toBeGreaterThanOrEqual(2);
    expect(all.has('should create user')).toBe(true);
    expect(all.has('should create post for user')).toBe(true);
  });
});
