import { AppError } from "@/lib/errors";

export function getServerEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function getRequiredServerEnv(name: string): string {
  const value = getServerEnv(name);

  if (!value) {
    throw new AppError({
      code: "missing_server_env",
      message: `The required server environment variable ${name} is missing.`,
      statusCode: 503,
    });
  }

  return value;
}
