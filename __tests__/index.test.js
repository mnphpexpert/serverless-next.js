const ServerlessPluginBuilder = require("../utils/test/ServerlessPluginBuilder");
const displayStackOutput = require("../lib/displayStackOutput");
const build = require("../lib/build");
const NextPage = require("../classes/NextPage");
const PluginBuildDir = require("../classes/PluginBuildDir");

jest.mock("js-yaml");
jest.mock("../lib/build");
jest.mock("../lib/parseNextConfiguration");
jest.mock("../lib/displayStackOutput");
jest.mock("../utils/logger");

describe("ServerlessNextJsPlugin", () => {
  let pluginBuilder;

  beforeEach(() => {
    pluginBuilder = new ServerlessPluginBuilder();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("#constructor", () => {
    let plugin;

    beforeAll(() => {
      plugin = new ServerlessPluginBuilder().build();
    });

    it.each`
      hook                                          | method
      ${"before:offline:start"}                     | ${"buildNextPages"}
      ${"before:package:initialize"}                | ${"buildNextPages"}
      ${"before:deploy:function:initialize"}        | ${"buildNextPages"}
      ${"before:package:createDeploymentArtifacts"} | ${"addAssetsBucketForDeployment"}
      ${"after:aws:deploy:deploy:uploadArtifacts"}  | ${"uploadStaticAssets"}
      ${"after:aws:info:displayStackOutputs"}       | ${"printStackOutput"}
      ${"after:package:createDeploymentArtifacts"}  | ${"removePluginBuildDir"}
    `("should hook to $hook with method $method", ({ hook, method }) => {
      expect(plugin.hooks[hook]).toEqual(plugin[method]);
    });
  });

  describe("#buildNextPages", () => {
    describe("packaging plugin build directory", () => {
      const nextConfigDir = "/path/to/next-app";

      beforeEach(() => {
        build.mockResolvedValueOnce([]);
      });

      it("should include plugin build directory for packaging", () => {
        expect.assertions(1);

        const plugin = pluginBuilder
          .withNextCustomConfig({ nextConfigDir })
          .build();

        return plugin.buildNextPages().then(() => {
          expect(plugin.serverless.service.package.include).toContain(
            `${nextConfigDir}/${PluginBuildDir.BUILD_DIR_NAME}/**`
          );
        });
      });

      it("should include plugin build directory for packaging when package include isn't defined", () => {
        expect.assertions(1);

        const plugin = pluginBuilder
          .withNextCustomConfig({ nextConfigDir })
          .build();

        plugin.serverless.service.package.include = undefined;

        return plugin.buildNextPages().then(() => {
          expect(plugin.serverless.service.package.include).toContain(
            `${nextConfigDir}/${PluginBuildDir.BUILD_DIR_NAME}/**`
          );
        });
      });
    });

    it("should call build with pluginBuildDir and user provided pageConfig", () => {
      expect.assertions(1);

      build.mockResolvedValueOnce([]);
      const nextConfigDir = "/path/to/next";

      const pageConfig = {
        home: {
          memory: "512"
        }
      };

      const plugin = new ServerlessPluginBuilder()
        .withNextCustomConfig({
          nextConfigDir: nextConfigDir,
          pageConfig
        })
        .build();

      return plugin.buildNextPages().then(() => {
        expect(build).toBeCalledWith(
          new PluginBuildDir(nextConfigDir),
          pageConfig
        );
      });
    });

    it("should set the next functions in serverless", () => {
      expect.assertions(1);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";
      const aboutPagePath = "/path/to/next/build/serverless/pages/about.js";

      build.mockResolvedValueOnce([
        new NextPage(homePagePath),
        new NextPage(aboutPagePath)
      ]);

      const plugin = new ServerlessPluginBuilder().build();

      return plugin.buildNextPages().then(() => {
        expect(Object.keys(plugin.serverless.service.functions)).toEqual([
          "homePage",
          "aboutPage"
        ]);
      });
    });

    it("should call service.setFunctionNames", () => {
      expect.assertions(1);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";
      const aboutPagePath = "/path/to/next/build/serverless/pages/about.js";

      build.mockResolvedValueOnce([
        new NextPage(homePagePath),
        new NextPage(aboutPagePath)
      ]);

      const setFunctionNamesMock = jest.fn();

      const plugin = new ServerlessPluginBuilder()
        .withService({
          setFunctionNames: setFunctionNamesMock
        })
        .build();

      return plugin.buildNextPages().then(() => {
        expect(setFunctionNamesMock).toBeCalled();
      });
    });
  });

  describe("#printStackOutput", () => {
    it("should call displayStackOutput with awsInfo", () => {
      const awsInfo = {
        constructor: {
          name: "AwsInfo"
        }
      };
      const getPlugins = jest.fn().mockReturnValueOnce([awsInfo]);

      const plugin = new ServerlessPluginBuilder()
        .withPluginManager({
          getPlugins
        })
        .build();

      plugin.printStackOutput();

      expect(displayStackOutput).toBeCalledWith(awsInfo);
    });
  });

  describe("#removePluginBuildDir", () => {
    it("should call pluginBuildDir.removeBuildDir", () => {
      const plugin = new ServerlessPluginBuilder().build();
      const mockRemoveBuildDir = jest.fn().mockResolvedValueOnce();
      plugin.pluginBuildDir.removeBuildDir = mockRemoveBuildDir;

      return plugin.removePluginBuildDir().then(() => {
        expect(mockRemoveBuildDir).toBeCalled();
      });
    });
  });
});
