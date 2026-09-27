#!/usr/bin/env node
/**
 * Prints a new team passphrase for LIVE_PUBLISH_TOKEN: five groups of four
 * characters, about 100 bits, e.g. "k7mq-2vxr-9dfh-w3tz-ep6c".
 *
 *   npm run new-passphrase
 *
 * Generated rather than chosen, so it can't be guessed from the team or the
 * season, and the relay's lockout (5 wrong tries per address per 10 minutes)
 * only protects the quota. Lowercase letters and digits, minus the ones that
 * are easy to misread on a phone screen (0 o 1 l i).
 */
import { randomInt } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const groups = Array.from({ length: 5 }, () =>
  Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
);
console.log(groups.join("-"));
