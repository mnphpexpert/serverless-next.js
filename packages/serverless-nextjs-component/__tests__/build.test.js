const path = require("path");
const fse = require("fs-extra");
const execa = require("execa");
const NextjsComponent = require("../serverless");
const { LAMBDA_AT_EDGE_BUILD_DIR } = require("../constants");

jest.mock("execa");

const mockS3Upload = jest.fn();
const mockS3 = jest.fn();
jest.mock("@serverless/aws-s3", () =>
  jest.fn(() => {
    const bucket = mockS3;
    bucket.init = () => {};
    bucket.default = () => {};
    bucket.context = {};
    bucket.upload = mockS3Upload;
    return bucket;
  })
);

const mockCloudFront = jest.fn();
jest.mock("@serverless/aws-cloudfront", () =>
  jest.fn(() => {
    const cloudFront = mockCloudFront;
    cloudFront.init = () => {};
    cloudFront.default = () => {};
    cloudFront.context = {};
    return cloudFront;
  })
);

const mockLambda = jest.fn();
const mockLambdaPublish = jest.fn();
jest.mock("@serverless/aws-lambda", () =>
  jest.fn(() => {
    const lambda = mockLambda;
    lambda.init = () => {};
    lambda.default = () => {};
    lambda.context = {};
    lambda.publishVersion = mockLambdaPublish;
    return lambda;
  })
);

describe("build tests", () => {
  let tmpCwd;
  let manifest;
  let componentOutputs;

  const fixturePath = path.join(__dirname, "./fixtures/simple-app");

  beforeEach(async () => {
    execa.mockResolvedValueOnce();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);

    mockS3.mockResolvedValue({
      name: "bucket-xyz"
    });
    mockLambda.mockResolvedValueOnce({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
    });
    mockLambdaPublish.mockResolvedValueOnce({
      version: "v1"
    });
    mockCloudFront.mockResolvedValueOnce({
      url: "https://cloudfrontdistrib.amazonaws.com"
    });

    const component = new NextjsComponent();
    componentOutputs = await component.default();

    manifest = await fse.readJSON(
      path.join(fixturePath, `${LAMBDA_AT_EDGE_BUILD_DIR}/manifest.json`)
    );
  });

  afterEach(() => {
    process.chdir(tmpCwd);
  });

  it("outputs next application url from cloudfront", () => {
    expect(componentOutputs).toEqual({
      appUrl: "https://cloudfrontdistrib.amazonaws.com"
    });
  });

  describe("manifest", () => {
    it("adds ssr page route", async () => {
      const {
        pages: {
          ssr: { nonDynamic }
        }
      } = manifest;

      expect(nonDynamic["/customers/new"]).toEqual("pages/customers/new.js");
    });

    it("adds ssr dynamic page route to express equivalent", async () => {
      const {
        pages: {
          ssr: { dynamic }
        }
      } = manifest;

      expect(dynamic["/blog/:id"]).toEqual({
        file: "pages/blog/[id].js",
        regex: "^\\/blog\\/([^\\/]+?)(?:\\/)?$"
      });
    });

    it("adds dynamic page with multiple segments to express equivalent", async () => {
      const {
        pages: {
          ssr: { dynamic }
        }
      } = manifest;

      expect(dynamic["/customers/:customer/:post"]).toEqual({
        file: "pages/customers/[customer]/[post].js",
        regex: "^\\/customers\\/([^\\/]+?)\\/([^\\/]+?)(?:\\/)?$"
      });
    });

    it("adds static page route", async () => {
      const {
        pages: { html }
      } = manifest;

      expect(html["/terms"]).toEqual("pages/terms.html");
    });

    it("adds public files", async () => {
      const { publicFiles } = manifest;

      expect(publicFiles).toEqual({
        "/favicon.ico": "favicon.ico",
        "/sw.js": "sw.js"
      });
    });

    it("adds the full manifest", async () => {
      const {
        pages: {
          ssr: { dynamic, nonDynamic },
          html
        }
      } = manifest;

      expect(dynamic).toEqual({
        "/:root": {
          file: "pages/[root].js",
          regex: expect.any(String)
        },
        "/blog/:id": {
          file: "pages/blog/[id].js",
          regex: expect.any(String)
        },
        "/customers/:customer": {
          file: "pages/customers/[customer].js",
          regex: expect.any(String)
        },
        "/customers/:customer/:post": {
          file: "pages/customers/[customer]/[post].js",
          regex: expect.any(String)
        },
        "/customers/:customer/profile": {
          file: "pages/customers/[customer]/profile.js",
          regex: expect.any(String)
        }
      });

      expect(nonDynamic).toEqual({
        "/customers/new": "pages/customers/new.js",
        "/": "pages/index.js",
        "/_app": "pages/_app.js",
        "/_document": "pages/_document.js",
        "/404": "pages/404.js"
      });

      expect(html).toEqual({
        "/terms": "pages/terms.html",
        "/about": "pages/about.html"
      });
    });

    it("adds s3 domain", () => {
      const {
        cloudFrontOrigins: { staticOrigin }
      } = manifest;

      expect(staticOrigin).toEqual({
        domainName: "bucket-xyz.s3.amazonaws.com"
      });
    });
  });

  describe("Lambda@Edge build files", () => {
    it("copies handler file", async () => {
      const files = await fse.readdir(
        path.join(fixturePath, `${LAMBDA_AT_EDGE_BUILD_DIR}/`)
      );

      expect(files).toContain("index.js");
    });

    it("copies manifest file", async () => {
      const files = await fse.readdir(
        path.join(fixturePath, `${LAMBDA_AT_EDGE_BUILD_DIR}/`)
      );

      expect(files).toContain("manifest.json");
    });

    it("copies compat file", async () => {
      const files = await fse.readdir(
        path.join(fixturePath, `${LAMBDA_AT_EDGE_BUILD_DIR}/`)
      );

      expect(files).toContain("next-aws-cloudfront.js");
    });
  });

  describe("assets bucket", () => {
    it("uploads client build assets", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: "./.next/static",
        keyPrefix: "_next/static"
      });
    });

    it("uploads user static directory", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: "./static",
        keyPrefix: "static"
      });
    });

    it("uploads user public directory", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: "./public",
        keyPrefix: "public"
      });
    });

    it("uploads html pages to S3", () => {
      ["terms.html", "about.html"].forEach(page => {
        expect(mockS3Upload).toBeCalledWith({
          file: `./.next/serverless/pages/${page}`,
          key: `static-pages/${page}`
        });
      });
    });
  });

  describe("cloudfront", () => {
    it("provisions and publishes lambda@edge", () => {
      expect(mockLambda).toBeCalledWith({
        description: expect.any(String),
        handler: "index.handler",
        code: `./${LAMBDA_AT_EDGE_BUILD_DIR}`,
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn: "arn:aws:iam::aws:policy/AdministratorAccess"
          }
        }
      });

      expect(mockLambdaPublish).toBeCalled();
    });

    it("creates distribution", () => {
      expect(mockCloudFront).toBeCalledWith({
        defaults: {
          allowedHttpMethods: expect.any(Array),
          ttl: 5,
          "lambda@edge": {
            "origin-request":
              "arn:aws:lambda:us-east-1:123456789012:function:my-func:v1" // includes version
          }
        },
        origins: [
          {
            url: "http://bucket-xyz.s3.amazonaws.com",
            private: true,
            pathPatterns: {
              "_next/*": {
                ttl: 86400
              },
              "static/*": {
                ttl: 86400
              }
            }
          }
        ]
      });
    });
  });
});
