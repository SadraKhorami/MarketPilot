import { validate } from "class-validator";

import { CredentialsDto, RegisterDto } from "./auth.dto";

describe("Credential validation", () => {
  it("accepts existing provisioned credentials at login but retains registration policy", async () => {
    const input = { email: "admin@example.com", password: "existing" };
    expect(await validate(Object.assign(new CredentialsDto(), input))).toHaveLength(0);
    expect(
      (await validate(Object.assign(new RegisterDto(), input))).some((error) => error.property === "password"),
    ).toBe(true);
    expect(await validate(Object.assign(new RegisterDto(), { ...input, password: "a-long-password" }))).toHaveLength(0);
  });
});
