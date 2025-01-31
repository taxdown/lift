import { get } from "lodash";
import * as sinon from "sinon";
import { baseConfig, runServerless } from "../utils/runServerless";

describe("single page app", () => {
    jest.mock("uuid", () => ({ v4: () => "123456789" }));
    afterEach(() => {
        sinon.restore();
    });
    afterAll(() => {
        jest.unmock("uuid");
    });

    it("should define a request function that redirects nested uris to index.html", async () => {
        const { cfTemplate, computeLogicalId } = await runServerless({
            command: "package",
            config: Object.assign(baseConfig, {
                constructs: {
                    landing: {
                        type: "single-page-app",
                        path: ".",
                        domain: ["www.example.com", "example.com"],
                        certificate:
                            "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123",
                    },
                },
            }),
        });
        const cfDistributionLogicalId = computeLogicalId("landing", "123456789");
        const requestFunction = computeLogicalId("landing", "RequestFunction");
        const responseFunction = computeLogicalId("landing", "ResponseFunction");
        expect(cfTemplate.Resources[requestFunction]).toMatchInlineSnapshot(`
            Object {
              "Properties": Object {
                "AutoPublish": true,
                "FunctionCode": "var REDIRECT_REGEX = /^[^.]+$|\\\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|xml|pdf|webmanifest|avif|wasm)$)([^.]+$)/;

            function handler(event) {
                var uri = event.request.uri;
                var request = event.request;
                var isUriToRedirect = REDIRECT_REGEX.test(uri);

                if (isUriToRedirect) {
                    request.uri = \\"/index.html\\";
                }

                return event.request;
            }",
                "FunctionConfig": Object {
                  "Comment": "app-dev-us-east-1-landing-request",
                  "Runtime": "cloudfront-js-1.0",
                },
                "Name": "app-dev-us-east-1-landing-request",
              },
              "Type": "AWS::CloudFront::Function",
            }
        `);

        expect(
            get(
                cfTemplate.Resources[cfDistributionLogicalId],
                "Properties.DistributionConfig.DefaultCacheBehavior.FunctionAssociations"
            )
        ).toMatchInlineSnapshot(`
            Array [
              Object {
                "EventType": "viewer-response",
                "FunctionARN": Object {
                  "Fn::GetAtt": Array [
                    "${responseFunction}",
                    "FunctionARN",
                  ],
                },
              },
              Object {
                "EventType": "viewer-request",
                "FunctionARN": Object {
                  "Fn::GetAtt": Array [
                    "${requestFunction}",
                    "FunctionARN",
                  ],
                },
              },
            ]
        `);
    });

    it("should define origins array with some configuration", async () => {
        const { cfTemplate, computeLogicalId } = await runServerless({
            command: "package",
            config: Object.assign(baseConfig, {
                constructs: {
                    landing: {
                        type: "single-page-app",
                        path: ".",
                        domain: ["www.example.com", "example.com"],
                        certificate:
                            "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123",
                        origins: [
                            {
                                path: "/api",
                                pathPattern: "api/",
                                domain: "api.example.com",
                                cacheBehavior: {
                                    allowedMethods: "ALL",
                                    cacheOptionsMethod: true,
                                    headers: ["*"],
                                },
                            },
                        ],
                    },
                },
            }),
        });
        const cfDistributionLogicalId = computeLogicalId("landing", "123456789");
        expect(
            get(cfTemplate.Resources[cfDistributionLogicalId], "Properties.DistributionConfig.Origins")
        ).toMatchObject([
            {
                DomainName: { "Fn::GetAtt": ["landingBucket2B5C7526", "RegionalDomainName"] },
                Id: "landing123456789Origin178B17E9A",
                S3OriginConfig: {
                    OriginAccessIdentity: {
                        "Fn::Join": [
                            "",
                            ["origin-access-identity/cloudfront/", { Ref: "landing123456789Origin1S3Origin98EA0851" }],
                        ],
                    },
                },
            },
            {
                CustomOriginConfig: { OriginProtocolPolicy: "https-only", OriginSSLProtocols: ["TLSv1.2"] },
                DomainName: "api.example.com",
                Id: "landing123456789Origin2D6C929C9",
                OriginPath: "/api",
            },
        ]);

        expect(
            get(cfTemplate.Resources[cfDistributionLogicalId], "Properties.DistributionConfig.CacheBehaviors")
        ).toMatchObject([
            {
                AllowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
                CachePolicyId: {
                    Ref: "landing123456789CachePolicyBD26FC38",
                },
                CachedMethods: ["GET", "HEAD", "OPTIONS"],
                Compress: true,
                PathPattern: "api/*",
                TargetOriginId: "landing123456789Origin2D6C929C9",
                ViewerProtocolPolicy: "allow-all",
            },
        ]);
    });

    it("should allow to redirect to the main domain", async () => {
        const { cfTemplate, computeLogicalId } = await runServerless({
            command: "package",
            config: Object.assign(baseConfig, {
                constructs: {
                    landing: {
                        type: "single-page-app",
                        path: ".",
                        domain: ["www.example.com", "example.com"],
                        certificate:
                            "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123",
                        redirectToMainDomain: true,
                    },
                },
            }),
        });
        const requestFunction = computeLogicalId("landing", "RequestFunction");
        expect(cfTemplate.Resources[requestFunction].Properties.FunctionCode).toMatchInlineSnapshot(`
            "var REDIRECT_REGEX = /^[^.]+$|\\\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|xml|pdf|webmanifest|avif|wasm)$)([^.]+$)/;

            function handler(event) {
                var uri = event.request.uri;
                var request = event.request;
                var isUriToRedirect = REDIRECT_REGEX.test(uri);

                if (isUriToRedirect) {
                    request.uri = \\"/index.html\\";
                }
                if (request.headers[\\"host\\"].value !== \\"www.example.com\\") {
                    return {
                        statusCode: 301,
                        statusDescription: \\"Moved Permanently\\",
                        headers: {
                            location: {
                                value: \\"https://www.example.com\\" + request.uri
                            }
                        }
                    };
                }

                return event.request;
            }"
        `);
    });

    it("allows overriding single page app properties", async () => {
        const { cfTemplate, computeLogicalId } = await runServerless({
            command: "package",
            config: Object.assign(baseConfig, {
                constructs: {
                    landing: {
                        type: "single-page-app",
                        path: ".",
                        extensions: {
                            distribution: {
                                Properties: {
                                    DistributionConfig: {
                                        Comment: "This is my comment",
                                    },
                                },
                            },
                            bucket: {
                                Properties: {
                                    ObjectLockEnabled: true,
                                },
                            },
                        },
                    },
                },
            }),
        });
        expect(cfTemplate.Resources[computeLogicalId("landing", "123456789")].Properties).toMatchObject({
            DistributionConfig: {
                Comment: "This is my comment",
            },
        });
        expect(cfTemplate.Resources[computeLogicalId("landing", "Bucket")].Properties).toMatchObject({
            ObjectLockEnabled: true,
        });
    });

    it("trims CloudFront function names to stay under the limit", async () => {
        const { cfTemplate, computeLogicalId } = await runServerless({
            command: "package",
            options: {
                stage: "super-long-stage-name",
            },
            config: Object.assign(baseConfig, {
                constructs: {
                    "suuuper-long-construct-name": {
                        type: "single-page-app",
                        path: ".",
                    },
                },
            }),
        });
        expect(cfTemplate.Resources[computeLogicalId("suuuper-long-construct-name", "RequestFunction")]).toMatchObject({
            Type: "AWS::CloudFront::Function",
            Properties: {
                Name: "app-super-long-stage-name-us-east-1-suuuper-long-construc-f3b7e1",
            },
        });
        expect(cfTemplate.Resources[computeLogicalId("suuuper-long-construct-name", "ResponseFunction")]).toMatchObject(
            {
                Type: "AWS::CloudFront::Function",
                Properties: {
                    Name: "app-super-long-stage-name-us-east-1-suuuper-long-construc-8c1f76",
                },
            }
        );
    });
});
