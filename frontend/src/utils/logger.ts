const log = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data ? data : '');
  
  // You can also implement file logging here if needed
  // For example, you could send logs to a backend endpoint
};

const error = (message: string, error?: any) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error ? error : '');
  
  // You can also implement file logging here if needed
  // For example, you could send error logs to a backend endpoint
};

export const logger = {
  log,
  error
};