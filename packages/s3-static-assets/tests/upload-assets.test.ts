import path from "path";
import uploadStaticAssets from "../src/index";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "../src/lib/constants";
import AWS, {
  mockGetBucketAccelerateConfigurationPromise,
  mockGetBucketAccelerateConfiguration,
  mockUpload
} from "aws-sdk";

// unfortunately can't use __mocks__ because aws-sdk is being mocked in other
// packages in the monorepo
// https://github.com/facebook/jest/issues/2070
jest.mock("aws-sdk", () => require("./aws-sdk.mock"));

const DEFAULT_FIXTURE = "./fixtures/basic-next-app";

const upload = (
  nextConfigDir?: string,
  nextStaticDir?: string
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  return uploadStaticAssets({
    bucketName: "test-bucket-name",
    nextConfigDir: path.join(__dirname, nextConfigDir || DEFAULT_FIXTURE),
    nextStaticDir: path.join(
      __dirname,
      nextStaticDir || nextConfigDir || DEFAULT_FIXTURE
    ),
    credentials: {
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    }
  });
};

describe("Upload tests shared", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("passes credentials to S3 client", async () => {
    await upload();

    expect(AWS.S3).toBeCalledWith({
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    });
  });

  it("uses accelerated bucket option if available", async () => {
    mockGetBucketAccelerateConfigurationPromise.mockResolvedValueOnce({
      Status: "Enabled"
    });

    await upload();

    expect(AWS.S3).toBeCalledTimes(2);
    expect(AWS.S3).toBeCalledWith({
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token",
      useAccelerateEndpoint: true
    });
    expect(mockGetBucketAccelerateConfiguration).toBeCalledWith({
      Bucket: "test-bucket-name"
    });
  });

  it("falls back to non accelerated client if checking for bucket acceleration throws an error", async () => {
    mockGetBucketAccelerateConfigurationPromise.mockRejectedValueOnce(
      new Error("Unexpected error!")
    );

    await upload();

    expect(consoleWarnSpy).toBeCalledWith(
      expect.stringContaining("falling back")
    );
    expect(AWS.S3).toBeCalledTimes(1);
  });

  describe("when no public or static directory exists", () => {
    it("upload does not crash", () => upload("./fixtures/app-no-public-dir"));
  });
});

describe.each([
  [[DEFAULT_FIXTURE, ""]],
  [["./fixtures/split-app/nextConfigDir", "./fixtures/split-app/nextStaticDir"]]
])(
  "Upload tests nextConfigDir=%s nextStaticDir=%s",
  ([nextConfigDir, nextStaticDir]) => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("uploads any contents inside the .next/static", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith({
        Bucket: "test-bucket-name",
        Key: "_next/static/a_test_build_id/two.js",
        Body: expect.any(Buffer),
        ContentType: "application/javascript",
        CacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
      });

      expect(mockUpload).toBeCalledWith({
        Bucket: "test-bucket-name",
        Key: "_next/static/a_test_build_id/css/one.css",
        Body: expect.any(Buffer),
        ContentType: "text/css",
        CacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
      });
    });

    it("uploads prerendered HTML pages specified in pages manifest", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/todos/terms.html",
          ContentType: "text/html",
          CacheControl: undefined
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/todos/terms/[section].html",
          ContentType: "text/html",
          CacheControl: undefined
        })
      );
    });

    it("uploads files in the public folder", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "public/robots.txt",
          ContentType: "text/plain",
          CacheControl: undefined
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "public/scripts/test-script.js",
          ContentType: "application/javascript",
          CacheControl: undefined
        })
      );
    });

    it("uploads files in the static folder", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static/robots.txt",
          ContentType: "text/plain",
          CacheControl: undefined
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static/scripts/test-script.js",
          ContentType: "application/javascript",
          CacheControl: undefined
        })
      );
    });
  }
);
