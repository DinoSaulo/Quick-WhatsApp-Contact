// Puppeteer utility helpers for robust browser automation with retry logic, frame validation,
// and improved error handling. Designed to handle transient frame/context errors in CI environments.

/**
 * Retries an async operation with exponential backoff.
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Configuration options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay between retries (default: 500)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 1.5)
 * @param {Function} options.shouldRetry - Predicate to determine if error is retryable (default: retries all)
 * @param {Function} options.onRetry - Callback when retrying (default: no-op)
 * @returns {Promise<*>} Result of the operation
 */
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

/**
 * Checks if an error is likely a transient frame/context error that could be retried.
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error appears to be transient
 */
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

/**
 * Validates that a page/frame is still valid before operations.
 * @param {Page} page - The Puppeteer page to validate
 * @param {string} context - Description of the context (for error messages)
 * @throws {Error} If the page is invalid
 */
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

/**
 * Safely evaluates JavaScript in a page with retry logic and frame validation.
 * @param {Page} page - The Puppeteer page
 * @param {Function} pageFunction - Function to evaluate in page context
 * @param {...*} args - Arguments to pass to pageFunction
 * @returns {Promise<*>} Result of the evaluation
 */
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

/**
 * Safely navigates to a URL with retry logic and improved error handling.
 * @param {Page} page - The Puppeteer page
 * @param {string} url - URL to navigate to
 * @param {Object} options - Navigation options (passed to page.goto)
 * @returns {Promise<HTTPResponse>} The response object
 */
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

/**
 * Safely waits for a selector with retry logic.
 * @param {Page} page - The Puppeteer page
 * @param {string} selector - Selector to wait for
 * @param {Object} options - Wait options (passed to page.waitForSelector)
 * @returns {Promise<ElementHandle>} The element handle
 */
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

/**
 * Waits for a condition to be true with diagnostic logging.
 * @param {Function} predicate - Async function that returns boolean
 * @param {string} failureMessage - Message to show if timeout occurs
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in milliseconds (default: 10_000)
 * @param {number} options.checkIntervalMs - Interval between checks (default: 100)
 * @throws {Error} If timeout expires
 */
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

/**
 * Merges the given Puppeteer launch options with CI-stability args (defaults first, so callers
 * can still override any of them). Synchronous by design — it does no I/O, it just builds an
 * options object for the caller to pass to puppeteer.launch() itself. It must stay synchronous:
 * every call site (and every doc example) calls it without `await`, so marking it `async` would
 * silently hand callers a Promise instead of the options object, dropping fields like
 * executablePath without any error until puppeteer.launch() rejects far downstream.
 * @param {Object} options - Puppeteer launch options
 * @returns {Object} Merged Puppeteer launch options
 */
export function launchBrowserWithStabilityFlags(options = {}) {
  // CI-specific stability improvements
  //
  // --disable-extensions must NOT be in this list: extension-install.mjs — this helper's only
  // caller — always passes enableExtensions: true precisely so it can load and test our own
  // extension. Puppeteer-core's ChromeLauncher reads that flag itself and pushes
  // --enable-unsafe-extension-debugging ahead of these args (see
  // node_modules/puppeteer-core/lib/puppeteer/node/ChromeLauncher.js's
  // computeLaunchArguments()), then appends this function's `args` *after* it. Chrome's
  // --disable-extensions has no "re-enable" counterpart a later flag can undo, so its mere
  // presence anywhere on the command line disables the extensions system outright — silently
  // overriding --enable-unsafe-extension-debugging regardless of order. The extension still
  // "installs" successfully (Puppeteer's own CDP-level bookkeeping doesn't check whether Chrome
  // actually loaded it), but its service worker never starts, and browser.waitForTarget(...) for
  // it times out after 30s. Confirmed as the cause of that exact timeout — reproduced both in CI
  // (Windows) and locally, since this is a Chrome flag conflict, not an OS-specific issue.
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

/**
 * Safely closes a browser with cleanup.
 * @param {Browser} browser - The browser instance
 */
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

/**
 * Safely closes a page with cleanup.
 * @param {Page} page - The page instance
 */
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

/**
 * Captures detailed diagnostics about the current browser state.
 * @param {Browser} browser - The browser instance
 * @returns {Object} Diagnostic information
 */
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
