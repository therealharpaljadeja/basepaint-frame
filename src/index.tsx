import { serveStatic } from "@hono/node-server/serve-static";
import { Button, Frog, TextInput } from "frog";
import { Hex, createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import BasePaintRewardsAbi from "../lib/baseRewards.js";
import { neynar } from "frog/hubs";
import {
    neynar as Neynar,
    NeynarUser,
    type NeynarVariables,
} from "frog/middlewares";
import { handle } from "frog/vercel";

const BASEPAINT_STARTED_AT = 1691599315;
const OPEN_EDITION_PRICE = 0.0026;

const client = createPublicClient({
    chain: base,
    transport: http(),
});

export const app = new Frog({
    // Supply a Hub to enable frame verification.
    hub: neynar({ apiKey: "NEYNAR_FROG_FM" }),
    secret: process.env.FROG_SECRET,
    basePath: "/api",
    browserLocation: "/:path",
    imageAspectRatio: "1:1",
    initialState: {
        count: 0,
        indexed: false,
        txHash: null as string | null,
    },
    dev: { enabled: false },
    verify: "silent",
    headers: {
        "Cache-Control": "max-age=0",
    },
});

app.use(
    Neynar({
        apiKey: "NEYNAR_FROG_FM",
        features: ["interactor", "cast"],
    })
);

app.frame("/", async (c) => {
    let latestBlock = await client.getBlock();
    let blockTimestamp = latestBlock.timestamp;

    let latestMint = Math.floor(
        (Number(blockTimestamp.toString()) - BASEPAINT_STARTED_AT) / 86400
    );

    return c.res({
        image: `https://basepaint.xyz/api/art/image?day=${latestMint}`,
        intents: [
            <TextInput placeholder="How many? (0.0026 ETH/piece)"></TextInput>,
            <Button action="/confirm">Confirm</Button>,
        ],
    });
});

app.transaction("/mint", (c) => {
    const { previousState } = c;
    const { interactor } = c.var as NeynarVariables;

    const cost = OPEN_EDITION_PRICE * previousState.count;

    let response = c.contract({
        chainId: "eip155:8453",
        to: "0xaff1A9E200000061fC3283455d8B0C7e3e728161",
        value: parseEther(cost.toString()),
        abi: BasePaintRewardsAbi,
        functionName: "mintLatest",
        args: [
            (interactor as NeynarUser).verifiedAddresses.ethAddresses[0] as Hex,
            BigInt(previousState.count),
            "0x8Cf24E66d1DC40345B1bf97219856C8140Ce6c69",
        ],
    });

    return response;
});

app.frame("/confirm", async (c) => {
    const {
        inputText,
        transactionId,
        buttonValue,
        previousState,
        deriveState,
    } = c;

    if (buttonValue === "_t") {
        if (transactionId === undefined || transactionId === "null")
            return c.res({
                image: (
                    <div
                        style={{
                            alignItems: "center",
                            background:
                                "linear-gradient(to right, #432889, #17101F)",
                            backgroundSize: "100% 100%",
                            display: "flex",
                            flexDirection: "column",
                            flexWrap: "nowrap",
                            height: "100%",
                            justifyContent: "center",
                            textAlign: "center",
                            width: "100%",
                        }}
                    >
                        <img
                            src="https://i.ibb.co/MPGGGL2/Add-a-heading-2.png"
                            height="650px"
                            width="650px"
                        />
                    </div>
                ),
                intents: [<Button.Reset>Reset 🔁</Button.Reset>],
            });

        let indexed = false;

        if (previousState.txHash && !previousState.indexed) {
            const txData = await fetch(
                `https://api.onceupon.gg/v1/transactions/${previousState.txHash}`
            );
            if (txData.status === 200) {
                indexed = true;
            }
        }

        const state = deriveState((previousState) => {
            previousState.txHash = transactionId;
            if (indexed) {
                previousState.indexed = true;
            }
        });

        const getIntents = (state: any) => {
            if (!state.indexed) {
                return [
                    <Button value="refresh">🔄 Refresh</Button>,
                    <Button.Link
                        href={`https://www.onceupon.gg/${state.txHash}`}
                    >
                        View Transaction
                    </Button.Link>,
                ];
            }
        };

        const getImage = async (state: any) => {
            if (state.indexed) {
                return `https://og.onceupon.gg/card/${state.txHash}`;
            } else {
                return (
                    <div
                        style={{
                            alignItems: "center",
                            background:
                                "linear-gradient(to right, #024BE5, #3D75EB)",
                            backgroundSize: "100% 100%",
                            display: "flex",
                            flexDirection: "column",
                            flexWrap: "nowrap",
                            height: "100%",
                            justifyContent: "center",
                            textAlign: "center",
                            width: "100%",
                        }}
                    >
                        <div
                            style={{
                                color: "white",
                                fontSize: 48,
                                fontStyle: "normal",
                                letterSpacing: "-0.025em",
                                lineHeight: 1.4,
                                marginTop: 30,
                                padding: "0 120px",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            Broadcasting...
                        </div>
                        <div
                            style={{
                                color: "white",
                                fontSize: 32,
                                fontStyle: "normal",
                                letterSpacing: "-0.025em",
                                lineHeight: 1.4,
                                marginTop: 30,
                                padding: "0 120px",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            <div>
                                Click "Refresh" below to check on your
                                transaction.
                            </div>
                        </div>
                    </div>
                );
            }
        };

        return c.res({
            image: await getImage(state),
            intents: getIntents(state),
        });
    }
    const quantity = inputText === "" ? 1 : Number(inputText);

    if (!quantity)
        return c.res({
            image: (
                <div
                    style={{
                        alignItems: "center",
                        background:
                            "linear-gradient(to right, #432889, #17101F)",
                        backgroundSize: "100% 100%",
                        display: "flex",
                        flexDirection: "column",
                        flexWrap: "nowrap",
                        height: "100%",
                        justifyContent: "center",
                        textAlign: "center",
                        width: "100%",
                    }}
                >
                    <img
                        src="https://i.ibb.co/tLXcgk3/Add-a-heading-1.png"
                        height="650px"
                        width="650px"
                    />
                </div>
            ),
            intents: [<Button.Reset>Reset 🔁</Button.Reset>],
        });

    const { interactor } = c.var as NeynarVariables;

    if (!interactor?.custodyAddress)
        return c.res({
            image: (
                <div
                    style={{
                        alignItems: "center",
                        backgroundSize: "100% 100%",
                        display: "flex",
                        flexDirection: "column",
                        flexWrap: "nowrap",
                        height: "100%",
                        justifyContent: "center",
                        textAlign: "center",
                        width: "100%",
                    }}
                >
                    <img
                        src="https://i.ibb.co/yS5KrS3/Add-a-heading.png"
                        height="650px"
                        width="650px"
                    />
                </div>
            ),
            intents: [<Button.Reset>Reset 🔁</Button.Reset>],
        });

    const cost = quantity * OPEN_EDITION_PRICE;

    c.deriveState((previousState) => {
        previousState.count = quantity;
    });

    return c.res({
        image: (
            <div
                style={{
                    alignItems: "center",
                    background: "linear-gradient(to right, #024BE5, #3D75EB)",
                    backgroundSize: "100% 100%",
                    display: "flex",
                    flexDirection: "column",
                    flexWrap: "nowrap",
                    height: "100%",
                    justifyContent: "center",
                    textAlign: "center",
                    width: "100%",
                }}
            >
                <div
                    style={{
                        color: "white",
                        fontSize: 36,
                        fontStyle: "normal",
                        letterSpacing: "-0.025em",
                        lineHeight: 1.4,
                        marginTop: 30,
                        padding: "0 120px",
                        whiteSpace: "pre-wrap",
                    }}
                >{`Cost To Mint: ${cost} ETH`}</div>
                <div
                    style={{
                        color: "white",
                        fontSize: 36,
                        fontStyle: "normal",
                        letterSpacing: "-0.025em",
                        lineHeight: 1.4,
                        marginTop: 30,
                        padding: "0 120px",
                        whiteSpace: "pre-wrap",
                    }}
                >{`for ${quantity} pieces`}</div>
                <div
                    style={{
                        color: "white",
                        fontSize: 24,
                        fontStyle: "normal",
                        letterSpacing: "-0.025em",
                        lineHeight: 1.4,
                        marginTop: 30,
                        padding: "0 120px",
                        whiteSpace: "pre-wrap",
                    }}
                >
                    Will be minted to farcaster connected address
                </div>
            </div>
        ),
        intents: [
            <Button.Transaction target="/mint">Confirm</Button.Transaction>,
            <Button.Reset>Reset 🔁</Button.Reset>,
        ],
    });
});

export const GET = handle(app);
export const POST = handle(app);
