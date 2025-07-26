import { before, after } from 'mocha';
import * as path from 'path';
import * as fs from 'fs';

// Global test setup
before(async function() {
  this.timeout(30000);
  
  console.log('Setting up E2E test environment...');
  
  // Create test fixtures directory
  const fixturesPath = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesPath)) {
    fs.mkdirSync(fixturesPath, { recursive: true });
  }
  
  // Create test documents for RAG testing
  const testDocsPath = path.join(fixturesPath, 'test-docs');
  if (!fs.existsSync(testDocsPath)) {
    fs.mkdirSync(testDocsPath, { recursive: true });
  }
  
  // Create sample documents
  fs.writeFileSync(
    path.join(testDocsPath, 'algorithms.txt'),
    `# Algorithm Study Notes
    
Binary Search:
- Time complexity: O(log n)
- Space complexity: O(1)
- Used for searching in sorted arrays

Dynamic Programming:
- Optimal substructure
- Overlapping subproblems
- Memoization vs tabulation

Graph Algorithms:
- DFS: Depth-first search
- BFS: Breadth-first search
- Dijkstra's algorithm for shortest paths`
  );
  
  fs.writeFileSync(
    path.join(testDocsPath, 'system-design.txt'),
    `# System Design Concepts

Scalability:
- Horizontal vs vertical scaling
- Load balancing
- Database sharding

Caching:
- Redis
- Memcached
- CDN (Content Delivery Network)

Microservices:
- Service decomposition
- API gateways
- Service mesh`
  );
  
  fs.writeFileSync(
    path.join(testDocsPath, 'behavioral.txt'),
    `# Behavioral Interview Preparation

STAR Method:
- Situation: Set the context
- Task: Describe your responsibility
- Action: Explain what you did
- Result: Share the outcome

Common Questions:
- Tell me about a time you faced a challenge
- Describe a project you're proud of
- How do you handle conflict?
- What's your greatest weakness?`
  );
  
  console.log('E2E test environment setup complete');
});

// Global test cleanup
after(async function() {
  this.timeout(10000);
  
  console.log('Cleaning up E2E test environment...');
  
  // Clean up test fixtures
  const fixturesPath = path.join(__dirname, 'fixtures');
  if (fs.existsSync(fixturesPath)) {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
  }
  
  // Clean up any test configuration files
  const testConfigPath = path.join(__dirname, '../../test-config.json');
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }
  
  console.log('E2E test environment cleanup complete');
});