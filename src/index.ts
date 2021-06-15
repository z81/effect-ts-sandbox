import * as T from "@effect-ts/core/Effect";
import * as A from "@effect-ts/core/Collections/Immutable/Array";
import { nextRange } from "@effect-ts/core/Effect/Random";
import { pipe, flow } from "@effect-ts/core/Function";
import * as ST from "@effect-ts/core/String";
import * as S from "@effect-ts/system/Stream";
import * as EX from "@effect-ts/system/Exit";
import * as Chunk from "@effect-ts/core/Collections/Immutable/Chunk";
import * as fs from "fs";
import * as path from "path";
import * as Schedule from "@effect-ts/core/Effect/Schedule";
import * as Clock from "@effect-ts/system/Clock";
const highlight = require("cli-highlight").highlight;

let eventLoopCount = 0;

const src = fs.readFileSync(path.join(__dirname, "..", "src", "index.ts"), "utf-8");

const reset = "\x1b[0m";
const color =
  (...codes: number[]) =>
  (str: string | number) =>
    `\x1b[${codes.join(";")}m${str}${reset}`;

const concat =
  (...colors: ReturnType<typeof color>[]) =>
  (arg: string | number) =>
    colors.reduceRight((str, fn) => fn(str), arg);

const black = color(30);
const bgBlue = concat(color(38, 5, 231), color(44));
const bgRed = concat(color(38, 5, 231), color(41));
const bgGreen = concat(color(38, 5, 231), color(42));
const bgAzure = concat(color(38, 5, 231), color(48, 5, 6));

// ---
const runLog =
  (title: string) =>
  async <E, A>(self: T.Effect<T.DefaultEnv, E, A>) => {
    const startTime = Date.now();
    const getTime = () => ` ${Date.now() - startTime}ms `;

    const code = new RegExp(`await (([^;]*)Log\\("${title.replace(/[\(\)]/gm, ".")}"\\)[ \n]*\\))`, "gm").exec(src)?.[1];

    console.log(code);

    try {
      const r = await T.runPromise(self);
      console.log(`${bgGreen(" Success ")} ${title} ${bgBlue(getTime())} `, r);
    } catch (e) {
      console.error(`${bgRed(" Error ")} ${title} ${bgBlue(getTime())}`, e);
    } finally {
      console.log();
    }
  };
// ---

const randomInt = pipe(
  nextRange(10, 1000),
  T.delay(1),
  T.map(Math.ceil),
  T.tap((num) => T.succeed(console.log(`${bgAzure(" Call ")} getRandom frame: ${bgBlue(` ${eventLoopCount} `)}`, num)))
);

// ---
const makeTimeout = () =>
  setTimeout(() => {
    eventLoopCount++;
    makeTimeout();
  }, 0);

makeTimeout();

(async () => {
  await pipe(randomInt, T.zip(randomInt), runLog("zip"));
  await pipe(randomInt, T.zip(T.fail("err")), runLog("zip err"));
  await pipe(randomInt, T.zipPar(randomInt), runLog("zipPar"));
  await pipe(randomInt, T.zipPar(T.fail("err")), runLog("zipPar err"));
  await pipe(T.tuple(randomInt, randomInt), runLog("tuple"));
  await pipe(T.tuple(randomInt, T.fail("err")), runLog("tuple err"));
  await pipe(T.tuplePar(randomInt, randomInt), runLog("tuplePar"));
  await pipe(T.tuplePar(randomInt, T.fail("err")), runLog("tuplePar"));
  await pipe(
    randomInt,
    T.orElse(() => randomInt),
    runLog("orElse")
  );
  await pipe(
    randomInt,
    T.orElse(() => T.fail("err")),
    runLog("orElse err")
  );
  await pipe(
    T.fail("err"),
    T.orElse(() => T.fail("err")),
    runLog("orElse err err")
  );
  await pipe(T.collectAll([randomInt, randomInt, randomInt, randomInt, randomInt]), T.map(Chunk.toArray), runLog("collectAll"));
  await pipe(T.collectAll([randomInt, randomInt, randomInt, T.fail("err"), randomInt]), T.map(Chunk.toArray), runLog("collectAll err"));
  await pipe(T.collectAllPar([randomInt, randomInt, randomInt, randomInt, randomInt]), T.map(Chunk.toArray), runLog("collectAllPar"));
  await pipe(T.collectAllPar([randomInt, randomInt, randomInt, T.fail("err"), randomInt]), T.map(Chunk.toArray), runLog("collectAllPar err"));
  await pipe(T.collectAllParN(2)([randomInt, randomInt, randomInt, randomInt, randomInt]), T.map(Chunk.toArray), runLog("collectAllParN(2)"));
  await pipe(T.collectAllParN(2)([randomInt, randomInt, randomInt, T.fail("err"), randomInt]), T.map(Chunk.toArray), runLog("collectAllParN(2) err"));
  await pipe(
    [randomInt, randomInt, randomInt, randomInt, randomInt],
    T.forEach((c) => c),
    T.map(Chunk.toArray),
    runLog("forEach")
  );
  await pipe(
    [randomInt, randomInt, randomInt, T.fail("err"), randomInt],
    T.forEach((c) => c),
    T.map(Chunk.toArray),
    runLog("forEach err")
  );
  await pipe(
    [randomInt, randomInt, randomInt, randomInt, randomInt],
    T.forEachPar((c) => c),
    T.map(Chunk.toArray),
    runLog("forEachPar")
  );
  await pipe(
    [randomInt, randomInt, randomInt, T.fail("err"), randomInt],
    T.forEachPar((c) => c),
    T.map(Chunk.toArray),
    runLog("forEachPar err")
  );
  await pipe(
    T.structPar({
      fiber: pipe(randomInt, T.delay(5), T.fork),
      num: randomInt,
      num2: randomInt,
    }),
    T.chain(({ num, num2, fiber }) =>
      pipe(
        fiber.await,
        T.map((n) => [n, num, num2])
      )
    ),
    runLog("fork")
  );
  await pipe(
    Chunk.range(1, 10),
    Chunk.dropWhile((n) => n > 5),
    S.fromChunk,
    S.filter((e) => e % 2 === 0),
    S.scanReduce((a, b) => a * b),
    S.runLast,
    runLog("Stream")
  );
  await pipe(
    randomInt,
    T.chain((n) => (n < 900 ? T.fail(`${n} < 900`) : T.succeed(n))),
    T.retry(Schedule.recurs(50)["&&"](Schedule.spaced(250))),
    runLog("retry")
  );
})();
