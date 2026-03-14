type AppErrorParams = {
  code: string;
  message: string;
  statusCode: number;
};

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor({ code, message, statusCode }: AppErrorParams) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError({
    code: "internal_error",
    message: "The request could not be processed.",
    statusCode: 500,
  });
}
