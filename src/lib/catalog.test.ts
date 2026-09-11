import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createFamily,
  createRef,
  deleteFamily,
  deleteRef,
  mergeCatalog,
  packingSpecs,
  seedCatalog,
  setRefActive,
  usableRefs,
} from "./catalog.ts";

test("graine : 2500×400 et 2500×600 actifs", () => {
  const c = seedCatalog();
  const specs = packingSpecs(c);
  assert.equal(specs.length, 2);
  assert.ok(specs.some((s) => s.length === 2500 && s.width === 400));
  assert.ok(specs.some((s) => s.length === 2500 && s.width === 600));
});

test("famille Tilly + référence 3000×600", () => {
  let c = seedCatalog();
  const fam = createFamily(c, "Tilly");
  assert.ok(fam.family);
  c = fam.catalog;
  const dup = createFamily(c, "tilly");
  assert.ok(dup.error);
  const ref = createRef(c, {
    familyId: fam.family!.id,
    name: "P-3000-600",
    length: 3000,
    width: 600,
  });
  assert.ok(ref.ref);
  c = ref.catalog;
  const again = createRef(c, {
    familyId: fam.family!.id,
    length: 3000,
    width: 600,
  });
  assert.ok(again.error);
});

test("référence désactivée absente des nouveaux débits", () => {
  let c = seedCatalog();
  c = setRefActive(c, "A", false);
  const usable = usableRefs(c);
  assert.equal(usable.some((r) => r.id === "A"), false);
  assert.equal(usable.some((r) => r.id === "B"), true);
  const withOld = packingSpecs(c, ["A"]);
  assert.ok(withOld.some((s) => s.id === "A"));
});

test("suppression refusée si utilisée", () => {
  const c = seedCatalog();
  const extra = createRef(c, {
    familyId: c.families[0]!.id,
    length: 3000,
    width: 400,
  });
  const blocked = deleteRef(extra.catalog, extra.ref!.id, [extra.ref!.id]);
  assert.ok(blocked.error);
  const ok = deleteRef(extra.catalog, extra.ref!.id, []);
  assert.equal(ok.error, undefined);
  const fam = createFamily(ok.catalog, "Egger");
  const delFam = deleteFamily(fam.catalog, fam.family!.id);
  assert.equal(delFam.error, undefined);
});

test("fusion de catalogue importé sans écraser", () => {
  const base = seedCatalog();
  const tilly = createFamily(base, "Tilly");
  const incoming = createRef(tilly.catalog, {
    familyId: tilly.family!.id,
    length: 3000,
    width: 600,
  }).catalog;
  const merged = mergeCatalog(base, incoming);
  assert.ok(merged.families.some((f) => f.name === "Tilly"));
  assert.ok(merged.refs.some((r) => r.length === 3000 && r.width === 600));
  const again = mergeCatalog(merged, incoming);
  assert.equal(
    again.refs.filter((r) => r.length === 3000 && r.width === 600).length,
    1,
  );
});
