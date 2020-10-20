describe("Rewrites Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Custom rewrites defined in next.config.js", () => {
    [
      {
        path: "/basepath/rewrite",
        expectedRewrite: "/basepath/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/basepath/path-rewrite/123",
        expectedRewrite: "/basepath/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/basepath/wildcard-rewrite/123",
        expectedRewrite: "/basepath/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/basepath/regex-rewrite-1/123",
        expectedRewrite: "/basepath/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/basepath/regex-rewrite-1/abc", // regex only matches numbers
        expectedRewrite: null,
        expectedStatus: null
      },
      {
        path: "/basepath/api/rewrite-basic-api",
        expectedRewrite: "/basepath/api/basic-api",
        expectedStatus: 200
      },
      {
        path: "/basepath/ssr-page",
        expectedRewrite: "/basepath/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/basepath/ssg-page",
        expectedRewrite: "/basepath/ssg-page",
        expectedStatus: 200
      },
      {
        path: "/basepath/app-store-badge.png",
        expectedRewrite: "/basepath/app-store-badge.png",
        expectedStatus: 200
      }
    ].forEach(({ path, expectedRewrite, expectedStatus }) => {
      it(`rewrites path ${path} to ${expectedRewrite}`, () => {
        if (expectedRewrite) {
          cy.request({
            url: path
          }).then((response) => {
            expect(response.status).to.equal(expectedStatus);
            cy.request({
              url: expectedRewrite
            }).then((rewriteResponse) => {
              // Check that the body of each page is the same, i.e it is actually rewritten
              expect(response.body).to.deep.equal(rewriteResponse.body);
            });
          });
        } else {
          // If no rewrite is expected, expect a 404 instead
          cy.request({
            url: path,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.equal(404);
          });
        }
      });
    });
  });
});
