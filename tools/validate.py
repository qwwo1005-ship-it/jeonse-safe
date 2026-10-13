import json, pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent / "content"
c = lambda n: json.load(open(R / n, encoding="utf-8"))
L, G, CK, K, P, Q, S, D = (c(x) for x in ["lessons.json","glossary.json","checklists.json","clauses.json","policy_updates.json","quiz.json","contract_sample.json","documents.json"])
lessons = {l["id"] for s in L["stages"] for l in s["lessons"]}; stages = {s["id"] for s in L["stages"]}
calcs = {x["id"] for x in L["calculators"]}; gl = {t["id"] for t in G["terms"]}; ck = {x["id"] for x in CK["checklists"]}
links = {x["id"] for x in L.get("refLinks", [])}
cl = {x["id"] for x in K["clauses"]}; pu = {x["id"] for x in P["items"]}; qs = {x["id"] for x in Q["questions"]}
hs = {h["id"] for s in S["samples"] for h in s["hotspots"]}; docs = {d["id"]: d for d in D["documents"]}
dhs = {h["id"] for d in D["documents"] for h in d["hotspots"]}
err = []
def chk(ids, pool, w):
    for i in ids:
        if i not in pool: err.append(f"{w}: {i}")
for s in L["stages"]:
    chk(s["checklistIds"], ck, s["id"])
    for l in s["lessons"]:
        chk(l.get("keyTerms", []), gl, l["id"]); chk(l.get("relatedClauseIds", []), cl, l["id"])
        chk(l.get("policyUpdateIds", []), pu, l["id"]); chk(l.get("contractHotspotIds", []), hs, l["id"])
        if "calculatorId" in l: chk([l["calculatorId"]], calcs, l["id"])
        chk(l.get("linkIds", []), links, l["id"])
for x in L["calculators"]: chk(x.get("linkIds", []), links, x["id"])
srcs = {s["id"] for s in c("meta.json")["sources"]}
for x in P["items"]:
    chk(x.get("sourceIds", []), srcs, x["id"] + " source")
    if x.get("status") not in ("IN_FORCE", "PASSED_PENDING", "PROPOSED", "PLANNED_SERVICE"): err.append(f"{x['id']}: unknown status {x.get('status')}")
for x in CK["checklists"]:
    for it in x["items"]:
        for k, pool in [("helpLessonId", lessons), ("contractHotspotId", hs), ("calculatorId", calcs)]:
            if k in it: chk([it[k]], pool, it["id"])
ids = [q["id"] for q in Q["questions"]]
if len(ids) != len(set(ids)): err.append("duplicate question ids")
for q in Q["questions"]:
    if not 0 <= q["answer"] < len(q["options"]): err.append("answer " + q["id"])
    chk([q["stageId"]], stages, q["id"])
    for k, pool in [("lessonId", lessons), ("contractHotspotId", hs), ("documentId", docs), ("documentHotspotId", dhs), ("clauseId", cl)]:
        if k in q: chk([q[k]], pool, q["id"])
for s in S["samples"]:
    sh = {h["id"] for h in s["hotspots"]}
    keys = {f["key"] for p in s["pages"] for sec in p["sections"] for f in sec["fields"]}
    for p in s["pages"]:
        for sec in p["sections"]:
            for f in sec["fields"]:
                if f.get("hotspotId"): chk([f["hotspotId"]], sh, s["id"] + ":" + f["key"])
                if f.get("clauseId"): chk([f["clauseId"]], cl, f["key"])
    for h in s["hotspots"]:
        chk(h.get("lessonIds", []), lessons, h["id"]); chk(h.get("quizIds", []), qs, h["id"])
        for k, pool in [("clauseId", cl), ("checklistId", ck), ("calculatorId", calcs), ("documentId", docs)]:
            if k in h: chk([h[k]], pool, h["id"])
    chk(s["viewerTour"], sh, s["id"] + " tour"); chk(s["context"].get("documentIds", []), docs, s["id"])
    S.setdefault("_keys", {})[s["id"]] = keys
for t in S["trapExercises"]:
    keys = S["_keys"][t["baseSampleId"]]
    for o in t["overrides"]:
        if o["fieldKey"] not in keys: err.append("trap " + o["fieldKey"])
    for k in t["decoys"]:
        if k not in keys: err.append("decoy " + k)
for d in D["documents"]:
    h = {x["id"] for x in d["hotspots"]}
    chk(d.get("lessonIds", []), lessons, d["id"]); chk(d["tourOrder"], h, d["id"] + " tour")
    for smp in d["samples"]:
        used = set()
        for sec in smp["sections"]:
            for r in sec.get("rows", []) + sec.get("fields", []):
                if r.get("hotspotId"): used.add(r["hotspotId"])
        for x in smp.get("header", []):
            if x.get("hotspotId"): used.add(x["hotspotId"])
        if smp.get("stampHotspotId"): used.add(smp["stampHotspotId"])
        chk(used, h, smp["id"])
chk(D["readingOrder"], docs, "readingOrder")
print("errors:", err or "none")
print(f"lessons {len(lessons)} terms {len(gl)} checklists {len(ck)} clauses {len(cl)} questions {len(qs)} contract samples {len(S['samples'])} documents {len(docs)}")
sys.exit(1 if err else 0)
