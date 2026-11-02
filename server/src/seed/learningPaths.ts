import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { env } from '../config/env.js';
import { LearningPath } from '../models/LearningPath.js';
import { LearningProgress } from '../models/LearningProgress.js';

interface SeedLesson {
  title: string;
  shortDescription: string;
  content: string;
  estimatedDurationMinutes: number;
  type: 'reading' | 'exercise';
}

interface SeedModule {
  title: string;
  description: string;
  lessons: SeedLesson[];
}

interface SeedPath {
  title: string;
  slug: string;
  shortDescription: string;
  detailedDescription: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  estimatedDurationMinutes: number;
  modules: SeedModule[];
}

function deterministicId(key: string): Types.ObjectId {
  return new Types.ObjectId(createHash('sha1').update(key).digest('hex').slice(0, 24));
}

const seedPaths: SeedPath[] = [
  {
    title: 'Full-Stack Web Development',
    slug: 'full-stack-web-development',
    shortDescription:
      'Go from semantic HTML to a deployed React and Express application with a shared data layer.',
    detailedDescription:
      'A practical introduction to the modern web stack. You will learn how browsers, servers, and APIs work together, then build interfaces with React and a typed Express backend. Lessons favour small exercises that reinforce the concepts you just read.',
    difficulty: 'beginner',
    category: 'Web Development',
    estimatedDurationMinutes: 600,
    modules: [
      {
        title: 'How the Web Works',
        description: 'The request and response model behind every web application.',
        lessons: [
          {
            title: 'Requests, Responses, and the Browser',
            shortDescription: 'Follow a URL from address bar to rendered page.',
            content:
              'When you enter a URL, the browser resolves the host, opens a connection, and sends an HTTP request. The server returns a status code, headers, and a body. Browsers then parse HTML, request CSS and JavaScript, and build the page.\n\nKey ideas:\n- HTTP is request/response.\n- Status codes describe outcomes: 2xx success, 3xx redirects, 4xx client errors, 5xx server errors.\n- Headers carry metadata such as content type and caching rules.\n\nExercise: open the network panel in your browser developer tools and inspect the status codes and content types for a page you use daily.',
            estimatedDurationMinutes: 15,
            type: 'reading',
          },
          {
            title: 'Semantic HTML and Accessible Structure',
            shortDescription: 'Choose elements that describe meaning, not appearance.',
            content:
              'Semantic elements such as header, nav, main, section, article, and footer give structure to a document. They help search engines, assistive technology, and future maintainers understand the page.\n\nUse buttons for actions and links for navigation. Label every form control. Preserve heading order so the document outline remains logical.\n\nExercise: take a page of plain div elements and rewrite it with landmark elements and one h1.',
            estimatedDurationMinutes: 20,
            type: 'reading',
          },
          {
            title: 'Responsive Layout with Flexbox and Grid',
            shortDescription: 'Build layouts that adapt from mobile to desktop.',
            content:
              'Flexbox distributes space along one axis and works well for toolbars, rows, and card internals. CSS Grid controls two dimensions and suits page-level layouts.\n\nStart mobile-first: write the small-screen layout, then add min-width breakpoints. Keep line lengths readable and avoid fixed heights that clip content.\n\nExercise: build a responsive card grid that shows one column on mobile, two on tablets, and three on desktop.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'JavaScript in the Browser',
        description: 'Language fundamentals and the browser APIs you use every day.',
        lessons: [
          {
            title: 'JavaScript Fundamentals Refresher',
            shortDescription: 'Values, functions, objects, and array methods.',
            content:
              'Modern JavaScript uses let and const for block-scoped bindings. Functions can be declared or expressed as arrow functions. Objects group related values, and arrays provide methods such as map, filter, and reduce for transformation.\n\nPrefer small pure functions that return new values instead of mutating shared state. That habit makes UI code easier to reason about.\n\nExercise: given an array of records, return only the active ones and compute their total count.',
            estimatedDurationMinutes: 30,
            type: 'reading',
          },
          {
            title: 'Events, Forms, and Validation',
            shortDescription: 'Handle user input without losing accessibility.',
            content:
              'Use addEventListener to respond to user actions. When handling a form submission, call preventDefault only when you are taking over the submission. Always keep native labels, required attributes, and useful error messages.\n\nClient-side validation improves the experience, but the server must validate every request again.\n\nExercise: build a controlled form that validates an email address and displays an inline error.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
          {
            title: 'Fetching Data from an API',
            shortDescription: 'Load remote data with loading, error, and empty states.',
            content:
              'The fetch API returns a promise for a response. Check response.ok before parsing JSON, and handle network failures separately from application errors.\n\nEvery data-driven screen needs loading, error, and empty states. Avoid showing stale or mock data when a request fails.\n\nExercise: fetch a list of items and render loading, error, empty, and success states.',
            estimatedDurationMinutes: 25,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'React and Express Together',
        description: 'Connect a component-based frontend to a typed backend.',
        lessons: [
          {
            title: 'React Components, State, and Effects',
            shortDescription: 'Model UI as a function of state.',
            content:
              'Components are functions that return UI. Keep state minimal and derive what you can. useEffect synchronizes with external systems such as the network; it is not a place for ordinary derived calculations.\n\nLift state only when siblings need to share it. Keep loading and error state next to the data it describes.\n\nExercise: create a list component with search, loading, and error states driven by state values.',
            estimatedDurationMinutes: 35,
            type: 'reading',
          },
          {
            title: 'Building a Typed Express API',
            shortDescription: 'Routes, validation, and consistent errors.',
            content:
              'Structure Express applications in layers: routes define endpoints, controllers translate HTTP, services own business rules, and models persist data. Validate every body, parameter, and query with a schema.\n\nReturn one error envelope shape across the API. Keep unknown errors generic and log the details on the server.\n\nExercise: add a resource with list and create endpoints, including strict validation and a 400 response.',
            estimatedDurationMinutes: 40,
            type: 'exercise',
          },
          {
            title: 'Connecting the Stack',
            shortDescription: 'Use a typed client and handle mutations safely.',
            content:
              'A typed API client centralizes base URLs, credentials, headers, and error mapping. Mutations should disable the triggering control while in flight and surface server validation errors next to the relevant field.\n\nRefresh local data after a successful mutation, and keep the interface honest when a request fails.\n\nExercise: connect a form to your API, then refresh the list after the create request succeeds.',
            estimatedDurationMinutes: 45,
            type: 'exercise',
          },
        ],
      },
    ],
  },
  {
    title: 'Data Structures and Algorithms',
    slug: 'data-structures-and-algorithms',
    shortDescription:
      'Build the core toolkit for analysing problems and writing efficient solutions.',
    detailedDescription:
      'This path covers complexity analysis, the data structures that appear most often in interviews and production code, and the traversal and sorting techniques built on top of them. Each module pairs a short reading with an exercise so you can practise the pattern immediately.',
    difficulty: 'intermediate',
    category: 'Data Structures & Algorithms',
    estimatedDurationMinutes: 720,
    modules: [
      {
        title: 'Complexity and Arrays',
        description: 'Reason about cost before choosing a solution.',
        lessons: [
          {
            title: 'Big-O Notation in Practice',
            shortDescription: 'Describe how running time grows with input size.',
            content:
              'Big-O compares growth rates rather than exact timings. Constant, logarithmic, linear, linearithmic, quadratic, and exponential classes cover most everyday analysis.\n\nState what n means, then count the dominant operations. Drop constants and lower-order terms. Amortized analysis explains why a push on a dynamic array is usually O(1).\n\nExercise: annotate five short functions with their time and space complexity.',
            estimatedDurationMinutes: 20,
            type: 'reading',
          },
          {
            title: 'Arrays and the Two-Pointer Pattern',
            shortDescription: 'Solve sorted-array problems in linear time.',
            content:
              'Two pointers move through a sequence, often from opposite ends, to avoid a nested loop. The pattern depends on an ordering property such as a sorted array.\n\nCommon uses include pair sums, palindrome checks, and in-place deduplication. Always prove that moving a pointer cannot skip a valid answer.\n\nExercise: find whether a sorted array contains two numbers that sum to a target in O(n) time.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
          {
            title: 'Sliding Window Patterns',
            shortDescription: 'Track a contiguous range without recomputing it.',
            content:
              'A sliding window maintains information about a contiguous subarray. Grow the right edge, and shrink the left edge when a constraint breaks.\n\nFixed-size windows suit problems such as maximum average; variable-size windows suit longest-substring constraints. Track counts in a map or a fixed array when the alphabet is small.\n\nExercise: find the length of the longest substring without repeating characters.',
            estimatedDurationMinutes: 25,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'Core Data Structures',
        description: 'Stacks, queues, maps, and linked lists with their trade-offs.',
        lessons: [
          {
            title: 'Stacks and Queues',
            shortDescription: 'LIFO and FIFO structures and their applications.',
            content:
              'A stack supports last-in, first-out access and powers undo history, parsing, and depth-first traversal. A queue supports first-in, first-out access and powers breadth-first traversal and scheduling.\n\nBoth are restrictive by design: exposing only the necessary operations keeps invariants clear. A deque can act as either structure when both ends are needed.\n\nExercise: use a stack to validate balanced brackets in a string.',
            estimatedDurationMinutes: 25,
            type: 'reading',
          },
          {
            title: 'Hash Maps and Sets',
            shortDescription: 'Constant-time lookups with careful key design.',
            content:
              'Hash maps trade memory for fast average-case lookup, insertion, and deletion. Sets store unique keys. Collisions are resolved internally, but adversarial or poor hash functions can degrade performance.\n\nChoose immutable, well-distributed keys. Iteration order is not something to rely on in most languages.\n\nExercise: find the first non-repeating character in a string using one pass and a map of counts.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
          {
            title: 'Linked Lists',
            shortDescription: 'Pointer-based sequences and in-place manipulation.',
            content:
              'A linked list stores values in nodes that point to the next node. Insertion and deletion at a known node are O(1), but lookup is O(n) and memory overhead is higher than an array.\n\nUse a dummy head to simplify edge cases. Draw pointers before writing the code; three local variables often make reversal and splicing readable.\n\nExercise: reverse a singly linked list iteratively and then detect a cycle.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'Trees, Graphs, and Sorting',
        description: 'Traversal, search, and comparison sorting.',
        lessons: [
          {
            title: 'Binary Trees and Traversal',
            shortDescription: 'Recursive and iterative visits of tree structures.',
            content:
              'A binary tree node has at most two children. Depth-first traversals visit pre-order, in-order, or post-order; breadth-first traversal uses a queue.\n\nRecursion expresses tree algorithms clearly, while an explicit stack avoids call-stack depth limits. In a binary search tree, an in-order traversal yields sorted keys.\n\nExercise: compute the maximum depth of a tree and return its in-order values.',
            estimatedDurationMinutes: 30,
            type: 'reading',
          },
          {
            title: 'Graph Search with BFS and DFS',
            shortDescription: 'Explore connectivity and shortest unweighted paths.',
            content:
              'Graphs consist of vertices and edges and can be directed or undirected. Represent them as adjacency lists for sparse graphs.\n\nBreadth-first search uses a queue and finds shortest paths in unweighted graphs. Depth-first search uses a stack or recursion and suits connectivity, cycle detection, and topological ordering. Always track visited vertices.\n\nExercise: count connected components in an undirected graph.',
            estimatedDurationMinutes: 35,
            type: 'exercise',
          },
          {
            title: 'Merge Sort and Quick Sort',
            shortDescription: 'Divide-and-conquer sorting and its trade-offs.',
            content:
              'Merge sort splits the array, sorts each half, and merges them. It guarantees O(n log n) time but needs O(n) auxiliary space. Quick sort partitions around a pivot and sorts in place; its average case is O(n log n), but poor pivots lead to O(n^2).\n\nRandomized or median-of-three pivots improve practice. Stable sorting matters when equal elements must retain their relative order.\n\nExercise: implement merge sort and explain why it is stable.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
        ],
      },
    ],
  },
  {
    title: 'Backend Development with Node.js and Express',
    slug: 'backend-development-node-express',
    shortDescription:
      'Design secure, tested APIs with Node.js, Express, validation, and MongoDB.',
    detailedDescription:
      'A hands-on path for developers who know JavaScript and want to build reliable backend services. You will work through the Node.js runtime, Express middleware, validation and security, data modelling, and API testing. The exercises mirror the architecture used in production CodeTogether services.',
    difficulty: 'intermediate',
    category: 'Backend Development',
    estimatedDurationMinutes: 540,
    modules: [
      {
        title: 'The Node.js Runtime',
        description: 'Async execution, project structure, and operational basics.',
        lessons: [
          {
            title: 'The Event Loop and Async I/O',
            shortDescription: 'Understand why Node handles many connections efficiently.',
            content:
              'Node runs JavaScript on a single main thread and delegates I/O to the operating system. The event loop processes timers, pending callbacks, and promise microtasks in phases.\n\nBlocking the main thread stops every request, so keep CPU-heavy work out of request handlers. Use promises and async/await for readability, and always handle rejections.\n\nExercise: write a script that reads three files concurrently and logs their completion order.',
            estimatedDurationMinutes: 25,
            type: 'reading',
          },
          {
            title: 'Modules, Configuration, and Structure',
            shortDescription: 'Lay out a server that stays maintainable.',
            content:
              'ES modules use import and export and are enabled with type: module in package.json. Configuration should be parsed once at startup, validated, and imported as a typed object.\n\nSeparate the application factory from the process entry point so tests can import the app without binding a port. Group code by responsibility: config, routes, controllers, services, models, middleware, and errors.\n\nExercise: refactor a single-file server into an app factory, a route module, and a config module.',
            estimatedDurationMinutes: 20,
            type: 'reading',
          },
          {
            title: 'Errors, Logging, and Shutdown',
            shortDescription: 'Fail predictably and leave useful evidence.',
            content:
              'Distinguish expected application errors from unexpected defects. A centralized error handler should map known errors to safe responses and log unknown errors with context.\n\nNever log passwords, cookies, tokens, or database connection strings. Handle SIGTERM and SIGINT by closing the HTTP server and database connection cleanly.\n\nExercise: add a custom error type, a centralized handler, and a graceful shutdown handler.',
            estimatedDurationMinutes: 25,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'Building Express APIs',
        description: 'Routing, validation, authentication, and security middleware.',
        lessons: [
          {
            title: 'Routing and Middleware',
            shortDescription: 'Compose small request-handling units.',
            content:
              'Express middleware receives the request, response, and next function. Order matters: security headers and CORS run before routes, and the error handler runs last.\n\nKeep routers declarative. Mount resource routers under a versioned prefix such as /api/v1. Use mergeParams for nested resources and validate route parameters like any other input.\n\nExercise: build a resource router with list, create, and detail endpoints and a 404 fallback.',
            estimatedDurationMinutes: 30,
            type: 'reading',
          },
          {
            title: 'Validation and Consistent Responses',
            shortDescription: 'Reject bad input at the boundary.',
            content:
              'Define a schema for every body, parameter, and query. Strict schemas reject unknown fields and prevent mass assignment. Replace the raw request data with parsed, typed values before the controller runs.\n\nUse consistent success and error envelopes. Validation failures should identify field paths without echoing the entire request.\n\nExercise: add Zod validation to a create endpoint and return field-level errors.',
            estimatedDurationMinutes: 35,
            type: 'exercise',
          },
          {
            title: 'Session Authentication',
            shortDescription: 'Server-side sessions, cookies, and CSRF protection.',
            content:
              'Server-side sessions store identity on the server and send an opaque identifier in an HTTP-only cookie. Rotate the session identifier after login to prevent fixation, and destroy it on logout.\n\nUse SameSite cookies and a session-bound CSRF token for state-changing requests. Never store sessions or tokens in client-readable storage.\n\nExercise: trace a login, authenticated request, and logout through an API you have built.',
            estimatedDurationMinutes: 30,
            type: 'reading',
          },
          {
            title: 'Rate Limits and Security Headers',
            shortDescription: 'Reduce abuse and browser-side risk.',
            content:
              'Rate limit authentication and expensive endpoints separately from general traffic. Key limits by IP and, when authenticated, by user. Return 429 with a retry hint.\n\nSet security headers with Helmet, configure an explicit CORS allowlist, and cap request body size. Do not combine wildcard origins with credentials.\n\nExercise: add authentication and general-purpose rate limits with safe error messages.',
            estimatedDurationMinutes: 25,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'Data and Operations',
        description: 'MongoDB modelling, consistency, and API testing.',
        lessons: [
          {
            title: 'Modeling Data with MongoDB',
            shortDescription: 'Design collections around access patterns.',
            content:
              'Model around the queries you need. Embed bounded, parent-owned data and reference data that grows without limit or is shared independently.\n\nDefine explicit schemas, required fields, enums, limits, and indexes. Add compound indexes in equality, sort, range order. Avoid unbounded arrays and unnecessary lookups on hot paths.\n\nExercise: model projects and owner-scoped queries with a compound owner and updatedAt index.',
            estimatedDurationMinutes: 30,
            type: 'reading',
          },
          {
            title: 'Consistency and Idempotency',
            shortDescription: 'Make retries safe and invariants explicit.',
            content:
              'Single-document updates are atomic. Prefer atomic operators such as $addToSet and $inc over read-modify-write. Use unique indexes to enforce invariants such as one record per user and resource.\n\nWhen a unique constraint causes a duplicate-key error, decide whether to return a conflict or treat the operation as an idempotent success. Transactions are available but should not replace careful document design.\n\nExercise: make an enrollment endpoint idempotent and enforce uniqueness with an index.',
            estimatedDurationMinutes: 25,
            type: 'reading',
          },
          {
            title: 'Testing APIs with Vitest and Supertest',
            shortDescription: 'Test behaviour against an isolated database.',
            content:
              'Supertest exercises the Express app without binding a network port. Use an isolated test database whose name ends in _test, clear collections between tests, and drop the database when the suite finishes.\n\nTest happy paths and failure modes: validation, authentication, authorization, invalid identifiers, cross-user isolation, and repeated requests.\n\nExercise: add integration tests for ownership isolation and CSRF rejection.',
            estimatedDurationMinutes: 35,
            type: 'exercise',
          },
        ],
      },
    ],
  },
  {
    title: 'Machine Learning Fundamentals',
    slug: 'machine-learning-fundamentals',
    shortDescription:
      'Frame problems, train core models, and evaluate them responsibly.',
    detailedDescription:
      'An approachable foundation in applied machine learning. You will learn how to frame a problem, prepare data, choose and evaluate basic models, and recognise the ethical and operational constraints that matter before deployment. The emphasis is on sound judgement rather than tooling trivia.',
    difficulty: 'advanced',
    category: 'Machine Learning',
    estimatedDurationMinutes: 660,
    modules: [
      {
        title: 'Data and Problem Framing',
        description: 'Turn a question into a measurable learning problem.',
        lessons: [
          {
            title: 'What Machine Learning Can and Cannot Solve',
            shortDescription: 'Separate prediction problems from rule-based work.',
            content:
              'Machine learning fits problems where patterns in historical data can generalise to new examples. It does not replace clear requirements, deterministic rules, or reliable data collection.\n\nDefine the decision the model will support, the target, and what a useful error looks like before choosing an algorithm. Ask whether mistakes are cheap or costly, and who is affected.\n\nExercise: write a one-page problem framing for a prediction task, including target, users, and failure costs.',
            estimatedDurationMinutes: 20,
            type: 'reading',
          },
          {
            title: 'Data Cleaning and Feature Design',
            shortDescription: 'Improve signal before reaching for a model.',
            content:
              'Inspect missing values, duplicates, outliers, and leakage. Split data before computing statistics that could leak validation information into training.\n\nFeatures should be measurable at prediction time. Scale numeric inputs when the algorithm is distance-sensitive, and encode categorical variables deliberately. Document every transformation.\n\nExercise: clean a small tabular dataset and list three candidate features with their risks.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
          {
            title: 'Train, Validation, and Test Splits',
            shortDescription: 'Estimate generalisation honestly.',
            content:
              'Use a training set to fit parameters, a validation set to choose models and settings, and a held-out test set for the final estimate. Cross-validation gives a more stable validation estimate on smaller datasets.\n\nFor time-dependent data, split chronologically. Never tune against the test set; it stops being an honest estimate.\n\nExercise: choose an appropriate split strategy for a time-series churn dataset and justify it.',
            estimatedDurationMinutes: 25,
            type: 'reading',
          },
        ],
      },
      {
        title: 'Core Models',
        description: 'Linear models, trees, and evaluation metrics.',
        lessons: [
          {
            title: 'Linear and Logistic Regression',
            shortDescription: 'Understand the baseline before complex models.',
            content:
              'Linear regression predicts a continuous value as a weighted sum of inputs. Logistic regression predicts a probability and is trained with a log-loss objective.\n\nRegularisation controls model complexity. Coefficients are interpretable but can be unstable when features are correlated. Always compare against a simple baseline.\n\nExercise: train a logistic regression classifier and inspect the effect of regularisation strength.',
            estimatedDurationMinutes: 35,
            type: 'reading',
          },
          {
            title: 'Decision Trees and Ensembles',
            shortDescription: 'Capture non-linear patterns with tree-based models.',
            content:
              'Decision trees split data on feature thresholds. Deep trees overfit, so limit depth, require minimum samples per leaf, or prune.\n\nRandom forests average many trees to reduce variance. Gradient boosting builds trees sequentially to reduce bias. Both are strong tabular baselines, but require careful validation and tuning.\n\nExercise: compare a single tree and a small random forest on the same validation split.',
            estimatedDurationMinutes: 35,
            type: 'exercise',
          },
          {
            title: 'Choosing Evaluation Metrics',
            shortDescription: 'Match the metric to the cost of mistakes.',
            content:
              'Accuracy can mislead on imbalanced data. Precision measures how often positive predictions are correct; recall measures how many actual positives were found. F1 balances the two. ROC AUC ranks predictions but can hide poor calibration.\n\nChoose a metric from the decision context, report a confusion matrix, and communicate uncertainty.\n\nExercise: compute precision, recall, and F1 for a small confusion matrix and explain which matters most.',
            estimatedDurationMinutes: 30,
            type: 'exercise',
          },
        ],
      },
      {
        title: 'Workflow and Responsibility',
        description: 'Regularisation, fairness, privacy, and deployment.',
        lessons: [
          {
            title: 'Bias, Variance, and Regularisation',
            shortDescription: 'Diagnose underfitting and overfitting.',
            content:
              'High bias means the model is too simple to capture the pattern. High variance means it memorises training noise. Compare training and validation errors to diagnose which is happening.\n\nRegularisation, simpler models, more data, and early stopping all reduce variance. More capacity or better features can reduce bias.\n\nExercise: explain a learning curve and propose one intervention for each failure mode.',
            estimatedDurationMinutes: 30,
            type: 'reading',
          },
          {
            title: 'Responsible ML and Data Privacy',
            shortDescription: 'Identify harm before deployment.',
            content:
              'Models can encode historical bias. Audit performance across relevant groups, document intended use, and provide a path for human review when decisions are high-stakes.\n\nCollect the minimum personal data required, protect it, and define retention. Avoid deploying sensitive inference without consent and legal review.\n\nExercise: list three stakeholders and one mitigation for a model that screens applications.',
            estimatedDurationMinutes: 25,
            type: 'reading',
          },
          {
            title: 'Deploying a Small Model Safely',
            shortDescription: 'Ship with monitoring and a rollback path.',
            content:
              'A deployment needs versioned artefacts, reproducible preprocessing, input validation, and a predictable failure mode. Log predictions without logging sensitive raw inputs.\n\nMonitor input drift, error rates, and outcome quality. Keep a baseline model and a rollback plan. Retraining should be deliberate and evaluated.\n\nExercise: sketch a deployment checklist for a model that scores support tickets.',
            estimatedDurationMinutes: 35,
            type: 'exercise',
          },
        ],
      },
    ],
  },
];

function buildModules(path: SeedPath) {
  return path.modules.map((module, moduleIndex) => ({
    _id: deterministicId(`${path.slug}:module:${moduleIndex}`),
    title: module.title,
    description: module.description,
    position: moduleIndex,
    lessons: module.lessons.map((lesson, lessonIndex) => ({
      _id: deterministicId(`${path.slug}:module:${moduleIndex}:lesson:${lessonIndex}`),
      title: lesson.title,
      shortDescription: lesson.shortDescription,
      content: lesson.content,
      estimatedDurationMinutes: lesson.estimatedDurationMinutes,
      type: lesson.type,
      position: lessonIndex,
    })),
  }));
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');

  if (reset && env.isProduction) {
    console.error('Refusing to reset learning path data in production.');
    process.exit(1);
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5_000 });
    await LearningPath.init();
    await LearningProgress.init();

    if (reset) {
      const [pathResult, progressResult] = await Promise.all([
        LearningPath.deleteMany({}),
        LearningProgress.deleteMany({}),
      ]);
      console.log(
        `Reset learning data: ${pathResult.deletedCount ?? 0} paths and ${progressResult.deletedCount ?? 0} progress records removed.`,
      );
    }

    for (const path of seedPaths) {
      await LearningPath.updateOne(
        { slug: path.slug },
        {
          $set: {
            title: path.title,
            slug: path.slug,
            shortDescription: path.shortDescription,
            detailedDescription: path.detailedDescription,
            difficulty: path.difficulty,
            category: path.category,
            estimatedDurationMinutes: path.estimatedDurationMinutes,
            modules: buildModules(path),
            status: 'published',
          },
        },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
    }

    const total = await LearningPath.countDocuments({});
    console.log(
      `Seeded ${seedPaths.length} curated learning paths (upsert by slug). ${total} total paths in the database.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Learning path seeding failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});
