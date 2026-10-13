"""content/*.json + src/* → dist/index.html (아티팩트용) + dist/standalone.html (일반 웹 호스팅용)"""
import json, pathlib

R = pathlib.Path(__file__).resolve().parent.parent
c = lambda n: json.loads((R / "content" / n).read_text(encoding="utf-8"))
content = {
    "meta": c("meta.json"), "lessons": c("lessons.json"), "glossary": c("glossary.json"),
    "checklists": c("checklists.json"), "clauses": c("clauses.json"), "insurance": c("insurance.json"),
    "policy": c("policy_updates.json"), "quiz": c("quiz.json"), "contracts": c("contract_sample.json"),
    "documents": c("documents.json"), "scams": c("scams.json"), "onboarding": c("onboarding.json"),
}
content["meta"]["files"]["documents"] = "documents.json"
blob = json.dumps(content, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
tpl = (R / "src" / "index.template.html").read_text(encoding="utf-8")
page = (tpl.replace("/*STYLE*/", (R / "src" / "style.css").read_text(encoding="utf-8"))
           .replace("/*CONTENT*/", blob)
           .replace("/*APP*/", (R / "src" / "app.js").read_text(encoding="utf-8")))
dist = R / "dist"; dist.mkdir(exist_ok=True)
(dist / "index.html").write_text(page, encoding="utf-8")
full = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + page.replace('<div class="shell">', '</head>\n<body>\n<div class="shell">', 1) + '\n</body>\n</html>\n')
(dist / "standalone.html").write_text(full, encoding="utf-8")
(dist / "preview.html").write_text((R / "src" / "preview.html").read_text(encoding="utf-8"), encoding="utf-8")  # 디자인 시안 비교(로컬 검토용)
print("built", len(page) // 1024, "KB")
