import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import installed from "../src/lib/exercise-media/installed.json" with { type: "json" };
import { exerciseMediaFiles, exerciseThumbUrl } from "@/lib/exercise-media";

let count = 0;
assert.equal(Object.keys(installed).length, 76);
for (const [slug, entry] of Object.entries(installed)) {
  const resolved = exerciseMediaFiles({ slug, name: entry.title, type: "main", gif_url: "https://old.invalid/old.gif", image_url: "/old.webp" });
  assert.equal(resolved[0].src, entry.files[0].src, "old workout snapshots must resolve to current media");
  for (const file of entry.files) {
    const gif = fs.readFileSync(path.join("public", file.src.split("?")[0]));
    assert.equal(crypto.createHash("sha256").update(gif).digest("hex"), file.sha256);
    assert.equal(gif.toString("ascii", 0, 6), "GIF89a");
    assert.equal(gif.readUInt16LE(6), 640); assert.equal(gif.readUInt16LE(8), 480);
    assert.ok(fs.statSync(path.join("public", file.thumb.split("?")[0])).size > 0);
    assert.equal(exerciseThumbUrl(file.src), file.thumb, "thumbnail keeps cache version");
    count++;
  }
}
assert.equal(count, 92);
assert.equal(exerciseThumbUrl("/x.gif?v=123"), "/x-thumb.webp?v=123");
assert.equal(exerciseMediaFiles({ slug: "unlisted", name: "Other", type: "main", gif_url: "/custom.gif" })[0].src, "/custom.gif");
console.log(`PASS:76 exercises,92 GIF hashes/dimensions and thumbnails; stale snapshot URLs replaced; cache versions preserved`);
