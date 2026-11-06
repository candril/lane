import { describe, expect, test } from "bun:test"
import { parseOpenArgs } from "./cli"

describe("parseOpenArgs (specs/063)", () => {
  test("takes the issue key after open", () => {
    expect(parseOpenArgs(["open", "SHOP-412"])).toEqual({ key: "SHOP-412" })
  })

  test("accepts a project key with digits", () => {
    expect(parseOpenArgs(["open", "A1B-7"])).toEqual({ key: "A1B-7" })
  })

  test("lets flags sit on either side of the key", () => {
    expect(parseOpenArgs(["open", "--mock", "SHOP-1"])).toEqual({ key: "SHOP-1" })
    expect(parseOpenArgs(["open", "SHOP-1", "--mock"])).toEqual({ key: "SHOP-1" })
  })

  test.each([
    [["open"]],
    [["open", "--mock"]],
    [["open", "shop-1"]],
    [["open", "SHOP"]],
    [["open", "SHOP-1;rm"]],
  ])("reports %j as a usage error", (args) => {
    expect(parseOpenArgs(args)).toEqual({ error: "usage: lane open <issue-key>" })
  })

  test("is not involved without the open subcommand", () => {
    expect(parseOpenArgs([])).toBeNull()
    expect(parseOpenArgs(["--mock"])).toBeNull()
    expect(parseOpenArgs(["view", "SHOP-1"])).toBeNull()
  })
})
