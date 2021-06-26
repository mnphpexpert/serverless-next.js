export type OriginConfig = {
  Id: string;
  DomainName: string;
  CustomHeaders: Record<string, unknown>;
  OriginPath: string;
  S3OriginConfig?: { OriginAccessIdentity: string };
  CustomOriginConfig?: {
    HTTPPort: number;
    HTTPSPort: number;
    OriginProtocolPolicy: Record<string, unknown> | string;
    OriginSslProtocols: {
      Quantity: number;
      Items: string[];
    };
    OriginReadTimeout: number;
    OriginKeepaliveTimeout: number;
  };
};

export type Options = { originAccessIdentityId: string };

export type Origin =
  | string
  | {
      protocolPolicy: string;
      url: string;
      pathPatterns: Record<string, unknown>;
    };

export const getOriginConfig = (
  origin: Origin,
  options: Options = { originAccessIdentityId: "" }
) => {
  const originUrl = typeof origin === "string" ? origin : origin.url;

  const { hostname, pathname } = new URL(originUrl);

  const originConfig: OriginConfig = {
    Id: hostname,
    DomainName: hostname,
    CustomHeaders: {
      Quantity: 0,
      Items: []
    },
    OriginPath: pathname === "/" ? "" : pathname
  };

  if (originUrl.includes("s3")) {
    const bucketName = hostname.split(".")[0];
    originConfig.Id = bucketName;
    originConfig.DomainName = hostname;
    originConfig.S3OriginConfig = {
      OriginAccessIdentity: options.originAccessIdentityId
        ? `origin-access-identity/cloudfront/${options.originAccessIdentityId}`
        : ""
    };
  } else {
    originConfig.CustomOriginConfig = {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy:
        typeof origin === "object" && origin.protocolPolicy
          ? origin.protocolPolicy
          : "https-only",
      OriginSslProtocols: {
        Quantity: 1,
        Items: ["TLSv1.2"]
      },
      OriginReadTimeout: 30,
      OriginKeepaliveTimeout: 5
    };
  }

  return originConfig;
};
