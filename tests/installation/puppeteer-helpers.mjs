// Puppeteer utility helpers for robust browser automation with retry logic, frame validation,
// and improved error handling. Designed to handle transient frame/context errors in CI environments.

// Retries an async operation with exponential backoff (maxAttempts/initialDelayMs/backoffMultiplier
// defaults: 3/500/1.5). shouldRetry gates which errors retry; onRetry fires before each retry.
export async function retryAsync(
  operation,
  {
    maxAttempts = 3,
    initialDelayMs = 500,
    backoffMultiplier = 1.5,
    shouldRetry = () => true,
    onRetry = () => {},
  } = {},
) {
  let lastError;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      onRetry(error, attempt, maxAttempts);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= backoffMultiplier;
    }
  }

  throw lastError;
}

// Checks if an error is likely a transient frame/context error that could be retried.
export function isTransientFrameError(error) {
  const message = String(error);
  const transientPatterns = [
    "no such frame",
    "Browsing Context",
    "ECONNREFUSED",
    "WebSocket is closed",
    "Target closed",
    "Protocol error",
    "Navigation failed",
    "ERR_FAILED",
    "ERR_NETWORK_CHANGED",
  ];

  return transientPatterns.some((pattern) => message.includes(pattern));
}

// Validates that a page/frame is still valid before operations; `context` labels the error message.
export async function validatePageIsAlive(page, context = "page") {
  if (!page) {
    throw new Error(`${context} is null or undefined`);
  }

  try {
    // Test the connection by evaluating a simple expression
    await page.evaluate(() => true);
  } catch (error) {
    throw new Error(
      `${context} became unavailable or disconnected: ${String(error)}`,
    );
  }
}

// Safely evaluates JavaScript in a page with retry logic and frame validation.
export async function safeEvaluate(page, pageFunction, ...args) {
  return retryAsync(
    async () => {
      await validatePageIsAlive(page, "page");
      return await page.evaluate(pageFunction, ...args);
    },
    {
      maxAttempts: 3,
      initialDelayMs: 300,
      shouldRetry: isTransientFrameError,
      onRetry: (error, attempt, maxAttempts) => {
        console.warn(
          `evaluate() failed (attempt ${attempt}/${maxAttempts}): ${error.message}`,
        );
      },
    },
  );
}

// Safely navigates to a URL with retry logic and improved error handling.
export async function safeGoto(page, url, options = {}) {
  const defaultOptions = {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
    ...options,
  };

  return retryAsync(
    async () => {
      await validatePageIsAlive(page, "page");
      return await page.goto(url, defaultOptions);
    },
    {
      maxAttempts: 3,
      initialDelayMs: 500,
      shouldRetry: isTransientFrameError,
      onRetry: (error, attempt, maxAttempts) => {
        console.warn(
          `goto(${url}) failed (attempt ${attempt}/${maxAttempts}): ${error.message}`,
        );
      },
    },
  );
}

// Safely waits for a selector with retry logic.
export async function safeWaitForSelector(page, selector, options = {}) {
  const defaultOptions = { timeout: 10_000, ...options };

  return retryAsync(
    async () => {
      await validatePageIsAlive(page, "page");
      return await page.waitForSelector(selector, defaultOptions);
    },
    {
      maxAttempts: 2,
      initialDelayMs: 300,
      shouldRetry: isTransientFrameError,
      onRetry: (error, attempt, maxAttempts) => {
        console.warn(
          `waitForSelector(${selector}) failed (attempt ${attempt}/${maxAttempts}): ${error.message}`,
        );
      },
    },
  );
}

// Waits for a condition to be true with diagnostic logging (timeout=10_000ms, checkIntervalMs=100 by default).
export async function waitUntilWithDiagnostics(
  predicate,
  failureMessage,
  { timeout = 10_000, checkIntervalMs = 100 } = {},
) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `waitUntil predicate threw: ${error.message} (will retry)`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }

  const elapsed = Date.now() - (deadline - timeout);
  if (lastError) {
    throw new Error(
      `${failureMessage} (after ${elapsed}ms, last error: ${lastError.message})`,
    );
  }

  throw new Error(`${failureMessage} (timeout after ${elapsed}ms)`);
}

// Merges the given launch options with CI-stability args (defaults first, so callers can override).
// Must stay synchronous — every call site calls it without `await`; marking it async would silently hand callers a Promise instead.
export function launchBrowserWithStabilityFlags(options = {}) {
  // --disable-extensions must NOT be in this list: extension-install.mjs always passes
  // enableExtensions: true, and this flag silently defeats that — confirmed cause of a 30s service-worker timeout, both in CI and locally.
  const defaultArgs = [
    "--disable-dev-shm-usage", // Prevent /dev/shm issues in Docker/CI
    "--disable-gpu", // Disable GPU acceleration for CI
    "--disable-plugins", // Disable browser plugins
    "--disable-sync", // Disable Chrome sync
    "--metrics-recording-only", // Reduce background work
  ];

  const mergedArgs = [
    ...defaultArgs,
    ...(options.args || []),
  ].filter((arg, idx, arr) => arr.indexOf(arg) === idx); // Deduplicate

  return {
    ...options,
    args: mergedArgs,
    timeout: 60_000, // Increased timeout for CI
  };
}

// Safely closes a browser with cleanup.
export async function safeBrowserClose(browser) {
  try {
    if (browser) {
      await browser.close();
    }
  } catch (error) {
    console.error(`Error closing browser: ${error.message}`);
    // Don't throw — best-effort cleanup
  }
}

// Safely closes a page with cleanup.
export async function safePageClose(page) {
  try {
    if (page) {
      await page.close();
    }
  } catch (error) {
    console.error(`Error closing page: ${error.message}`);
    // Don't throw — best-effort cleanup
  }
}

// Captures detailed diagnostics about the current browser state.
export async function captureBrowserDiagnostics(browser) {
  try {
    const targets = browser.targets();
    const pages = await browser.pages();

    return {
      timestamp: new Date().toISOString(),
      totalTargets: targets.length,
      targetTypes: targets.reduce(
        (acc, t) => {
          acc[t.type()] = (acc[t.type()] || 0) + 1;
          return acc;
        },
        {},
      ),
      totalPages: pages.length,
      pageUrls: pages.map((p) => ({
        url: p.url(),
        title: p.title?.() || "?",
      })),
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      error: String(error),
    };
  }
}
