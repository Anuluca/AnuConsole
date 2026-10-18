export function developmentAuthBypass(environment: string | undefined = process.env.NODE_ENV): boolean {
  return environment === "development";
}
