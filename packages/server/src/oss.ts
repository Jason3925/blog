import OSS from "ali-oss";
import { env } from "./env";

let cached: OSS | null | undefined;

export function getOssClient(): OSS | null {
  if (cached !== undefined) return cached;
  if (!env.ossAccessKeyId || !env.ossAccessKeySecret || !env.ossRegion || !env.ossBucket) {
    cached = null;
    return cached;
  }

  cached = new OSS({
    region: env.ossRegion,
    accessKeyId: env.ossAccessKeyId,
    accessKeySecret: env.ossAccessKeySecret,
    authorizationV4: true,
    bucket: env.ossBucket,
    ...(env.cdnDomain
      ? { endpoint: env.cdnDomain.replace(/^https?:\/\//, ""), cname: true }
      : {}),
  });
  return cached;
}

export function ossConfigured(): boolean {
  return getOssClient() !== null;
}
