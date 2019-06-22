const path = require("path");
const fs = require("fs");
const { when } = require("jest-when");
const uploadStaticAssets = require("../uploadStaticAssets");
const parseNextConfiguration = require("../parseNextConfiguration");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const uploadDirToS3Factory = require("../../utils/s3/upload");

jest.mock("fs");
jest.mock("../../utils/s3/upload");
jest.mock("../parseNextConfiguration");

describe("uploadStaticAssets", () => {
  let uploadDirToS3;

  beforeEach(() => {
    uploadDirToS3 = jest.fn().mockResolvedValue();
    uploadDirToS3Factory.mockReturnValue(uploadDirToS3);
  });

  it("should NOT upload build assets when there isn't a bucket available", () => {
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({}, null)
    );

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).not.toBeCalled();
    });
  });

  it("should upload next build assets", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledTimes(1);
      expect(uploadDirToS3).toBeCalledWith(
        path.join("/path/to/next", distDir, "static"),
        {
          bucket: "my-bucket",
          truncate: "static",
          rootPrefix: "_next"
        }
      );
    });
  });

  it("should upload next build assets using bucketName from plugin config", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        assetsBucketName: "custom-bucket"
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(
        path.join("/path/to/next", distDir, "static"),
        {
          bucket: "custom-bucket",
          truncate: "static",
          rootPrefix: "_next"
        }
      );
    });
  });

  it("should upload staticDir", () => {
    const staticDir = "/path/to/assets";

    when(fs.readdirSync)
      .calledWith(staticDir)
      .mockReturnValueOnce(["foo/bar.js"]);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        staticDir
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(staticDir, {
        bucket: "my-bucket",
        truncate: "assets"
      });
    });
  });

  it("should upload publicDir", () => {
    const publicDir = "/path/to/assets";

    when(fs.readdirSync)
      .calledWith(publicDir)
      .mockReturnValueOnce(["foo/bar.js"]);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        publicDir
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(publicDir, {
        bucket: "my-bucket",
        truncate: "assets"
      });
    });
  });

  it("should not upload build assets", () => {
    const staticDir = "/path/to/assets";

    when(fs.readdirSync)
      .calledWith(staticDir)
      .mockReturnValueOnce(["foo/bar.js"]);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        uploadBuildAssets: false,
        staticDir
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledTimes(1);
      expect(uploadDirToS3).toBeCalledWith(staticDir, {
        bucket: "my-bucket",
        truncate: "assets"
      });
    });
  });
});
