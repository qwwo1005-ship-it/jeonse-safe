"""contract_sample.json 에 빌라 전세·다가구 전세·오피스텔 보증금 월세 예시와 위험찾기 문제를 추가한다."""
import json, copy, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "content"
path = ROOT / "contract_sample.json"
data = json.loads(path.read_text(encoding="utf-8"))
base = next(s for s in data["samples"] if s["id"] == "contract_apt_jeonse_01")
data["samples"] = [base]
base["label"] = "아파트 전세"
base["summary"] = "보증금 3억 2천만 원 · 시세 5억 · 근저당 6천만 원 — 특약이 잘 갖춰진 기본 예시"
base["verdict"] = {"level": "yellow", "title": "기본은 갖췄지만 전세가율 76%는 주의 구간",
                   "points": ["특약 6개로 담보 설정·보증 거절·체납 위험을 막아둠", "보증금+근저당이 시세의 76% — 보증보험 가입은 필수"]}


def make(sample_id, label, title, summary, context, values, specials, hs_override=None, hs_extra=None,
         field_hs=None, tour=None, verdict=None, house="VILLA", lease="JEONSE"):
    s = copy.deepcopy(base)
    s.update(id=sample_id, label=label, title=title, summary=summary, context=context,
             houseType=house, leaseType=lease, verdict=verdict)
    for page in s["pages"]:
        for sec in page["sections"]:
            if sec["id"] == "sec_special":
                sec["fields"] = [
                    {"key": f"sp{i+1}", "label": f"특약 {i+1}", "value": text,
                     "hotspotId": hs or "hs_special_terms", **({"clauseId": cid} if cid else {})}
                    for i, (cid, text, hs) in enumerate(specials)]
                continue
            for f in sec["fields"]:
                if f["key"] in values:
                    f["value"] = values[f["key"]]
                if field_hs and f["key"] in field_hs:
                    f["hotspotId"] = field_hs[f["key"]]
    hs_map = {h["id"]: h for h in s["hotspots"]}
    for hid, patch in (hs_override or {}).items():
        hs_map[hid].update(patch)
    s["hotspots"] = list(hs_map.values()) + (hs_extra or [])
    s["viewerTour"] = tour or s["viewerTour"]
    return s


# ---------- 1. 빌라 전세 (위험 사례) ----------
villa = make(
    "contract_villa_jeonse_01", "빌라 전세", "빌라(다세대) 전세 계약서 예시 — 위험 사례",
    "보증금 2억 1천만 원 · 공시가격 1억 6천만 원 · 근저당 3,600만 원 — 특약 덕분에 빠져나올 수 있는 사례",
    {"marketPrice": 260000000, "marketPriceNote": "중개사가 말한 시세(실거래 기록 없음)", "officialPrice": 160000000,
     "seniorDebt": 36000000, "documentIds": ["doc_registry", "doc_building"],
     "calc": {"hug126Limit": 201600000, "explain": "공시가격 1억 6천만 × 126% = 2억 160만 원 < 보증금 2억 1천만 + 근저당 3,600만 = 2억 4,600만 원 → HUG 보증 불가. 중개사가 말한 시세 2억 6천만 원 기준이면 95% — 깡통전세."}},
    {
        "parties": "임대인 박빠른 과 임차인 이지킴 은 아래와 같이 임대차 계약을 체결한다.",
        "address": "경기도 가상시 샘플구 연습로 45",
        "land": "지목: 대 / 대지권 면적: 18.30㎡",
        "building": "구조·용도: 철근콘크리트구조 공동주택(다세대주택) / 면적: 39.80㎡",
        "leasedPart": "연습빌라 제3층 제302호 전부 / 39.80㎡",
        "taxArrears": "☑ 없음 (임대인 서명: 박빠른 ㊞)  ☐ 있음",
        "seniorFixedDate": "☑ 해당 없음 (임대인 서명: 박빠른 ㊞)  ☐ 해당 있음",
        "deposit": "금 이억일천만원정 (₩210,000,000)",
        "downPayment": "금 이천일백만원정(₩21,000,000)은 계약 시 지불하고 영수함. 영수자: 박빠른 ㊞",
        "balance": "금 일억팔천구백만원정(₩189,000,000)은 2026년 12월 20일에 지불한다.",
        "maintenanceFee": "정액 월 70,000원 (공용 전기·계단 청소·공용 수도 포함, 세대 전기·가스·수도는 임차인 부담)",
        "account": "가상은행 222-2222-2222 (예금주: 박빠른)",
        "period": "임대인은 임차주택을 2026년 12월 20일까지 임차인에게 인도하고, 임대차기간은 인도일로부터 2028년 12월 19일까지로 한다.",
        "repair": "☐ 있음  ☑ 없음",
        "contractDate": "2026년 11월 2일",
        "lessor": "주소: (등기부상 주소와 동일) / 성명: 박빠른 ㊞ / 연락처: 010-0000-0000",
        "broker": "사무소: 연습공인중개사사무소 / 등록번호: 가상-0000-11111 / 대표: 문빠름 ㊞",
    },
    [
        ("cl_no_mortgage_until_next_day", "임대인은 잔금 지급일 다음 날까지 본 주택에 저당권 등 어떠한 담보권도 설정하지 않으며 소유권 이전 등 권리변동을 일으키지 않는다. 위반 시 임차인은 계약을 해제할 수 있고, 임대인은 보증금 전액을 즉시 반환하며 계약금 상당액을 배상한다.", None),
        ("cl_insurance_void", "본 계약은 임차인의 전세보증금반환보증 가입을 전제로 하며, 부채비율 초과·위반건축물 등 임대인 또는 주택의 사유로 가입이 거절될 경우 계약은 무효로 하고 임대인은 수령 금원 전액을 즉시 반환한다.", "hs_villa_void"),
        ("cl_loan_void", "임대인 또는 본 주택의 사유로 임차인의 전세자금대출이 불가할 경우 본 계약은 무효로 하며, 임대인은 수령한 계약금을 즉시 전액 반환한다.", "hs_villa_void"),
        ("cl_keep_rights", "임대인은 계약일 현재 권리상태(을구 1번 근저당권 채권최고액 금 3,600만 원)를 잔금일까지 유지하며 추가 담보권을 설정하지 않는다.", None),
        ("cl_tax_none", "임대인은 국세·지방세 체납 사실이 없음을 확인하며, 잔금 지급일 이전에 체납 또는 압류·가압류가 확인되면 임차인은 계약을 해제할 수 있다.", None),
    ],
    hs_override={
        "hs_parties": {"explain": "등기부 갑구 마지막 소유자 '박빠른'과 같아요. 다만 2024년 3월에 산 직후 같은 날 근저당이 잡혀 있어 갭투자 패턴이에요.", "documentId": "doc_registry"},
        "hs_building_use": {"explain": "다세대주택(주택)은 맞지만 건축물대장에 '위반건축물'(옥상 무단 증축) 표시가 있어요. 계약서 칸에는 이 정보가 드러나지 않으니 건축물대장을 꼭 따로 보세요.", "level": "critical", "documentId": "doc_building"},
        "hs_deposit": {"explain": "보증금 2억 1천만 원 + 근저당 3,600만 원 = 2억 4,600만 원. 공시가격 1억 6천만 원 × 126% = 2억 160만 원을 넘어 HUG 보증이 안 돼요.", "calculatorId": "calc_hug_126"},
        "hs_maintenance": {"explain": "빌라 정액 관리비는 포함 항목을 적어야 해요. 이 예시는 항목이 적혀 있어 괜찮아요."},
    },
    hs_extra=[
        {"id": "hs_villa_void", "level": "critical", "title": "이 계약을 살리는 특약", "explain": "이 집은 보증보험이 거절될 가능성이 매우 커요. '보증 거절·대출 불가 시 무효, 계약금 반환' 특약이 있으면 계약금 2,100만 원을 돌려받고 빠져나올 수 있어요. 특약이 없었다면 계약금을 잃거나 위험한 계약을 그대로 이어가야 해요.", "check": ["보증 가입 가능 여부를 계약 전에 먼저 확인", "특약에 '임대인 또는 주택의 사유' 명시"], "lessonIds": ["ls_04_03"]}
    ],
    tour=["hs_parties", "hs_building_use", "hs_deposit", "hs_villa_void", "hs_deposit_account", "hs_balance", "hs_special_terms", "hs_broker"],
    verdict={"level": "red", "title": "특약은 좋지만 집 자체가 위험해요",
             "points": ["공시가격 126% 초과 → 보증보험 불가", "위반건축물 표시 → 보증·대출 거절 사유", "매수 직후 근저당 + 전세 = 갭투자 패턴", "'보증 거절 시 무효' 특약 덕분에 계약금은 지킬 수 있음"]},
)

# ---------- 2. 다가구 전세 ----------
multi = make(
    "contract_multi_jeonse_01", "다가구 전세", "다가구주택 전세 계약서 예시 — 선순위 보증금 확인",
    "보증금 1억 2천만 원 · 선순위 보증금 6억 3천만 원 · 근저당 3억 원 — 등기부에 안 보이는 빚이 핵심",
    {"marketPrice": 900000000, "officialPrice": None, "seniorDebt": 300000000, "seniorDeposits": 630000000,
     "documentIds": ["doc_building", "doc_movein", "doc_fixeddate"],
     "calc": {"explain": "근저당 3억 + 선순위 보증금 6억 3천만 + 내 보증금 1억 2천만 = 10억 5천만 원 > 시세 9억 원 → 117%. 경매 시 내 보증금은 거의 회수 불가."}},
    {
        "parties": "임대인 한건물 과 임차인 이지킴 은 아래와 같이 임대차 계약을 체결한다.",
        "address": "경기도 가상시 샘플구 연습로 77",
        "land": "지목: 대 / 면적: 198.0㎡",
        "building": "구조·용도: 철근콘크리트구조 단독주택(다가구주택), 제2종근린생활시설 / 연면적: 353.10㎡",
        "leasedPart": "4층 중 일부(현관 표시 403호) / 약 24㎡",
        "taxArrears": "☑ 없음 (임대인 서명: 한건물 ㊞)  ☐ 있음",
        "seniorFixedDate": "☐ 해당 없음  ☑ 해당 있음 — 선순위 확정일자 6건, 보증금 합계 금 630,000,000원 (확정일자 부여현황 별첨)",
        "deposit": "금 일억이천만원정 (₩120,000,000)",
        "downPayment": "금 일천이백만원정(₩12,000,000)은 계약 시 지불하고 영수함. 영수자: 한건물 ㊞",
        "balance": "금 일억팔백만원정(₩108,000,000)은 2026년 12월 1일에 지불한다.",
        "maintenanceFee": "정액 월 50,000원 (공용 전기·인터넷·청소 포함)",
        "account": "가상은행 333-3333-3333 (예금주: 한건물)",
        "period": "임대인은 임차주택을 2026년 12월 1일까지 임차인에게 인도하고, 임대차기간은 인도일로부터 2028년 11월 30일까지로 한다.",
        "repair": "☐ 있음  ☑ 없음",
        "lessor": "주소: (등기부상 주소와 동일) / 성명: 한건물 ㊞ / 연락처: 010-0000-0000",
        "broker": "사무소: 연습공인중개사사무소 / 등록번호: 가상-0000-11111 / 대표: 문빠름 ㊞",
    },
    [
        ("cl_multi_family_disclosure", "임대인은 계약일 현재 본 건물의 선순위 임차보증금 총액이 금 630,000,000원(6건)임을 고지하며, 사실과 다를 경우 임차인은 계약을 해제할 수 있고 임대인은 수령 금원 전액 반환 및 계약금 상당액을 배상한다.", "hs_multi_disclose"),
        ("cl_no_mortgage_until_next_day", "임대인은 잔금 지급일 다음 날까지 본 건물에 담보권을 설정하지 않으며 권리변동을 일으키지 않는다. 위반 시 임차인은 계약을 해제할 수 있다.", None),
        ("cl_insurance_void", "본 계약은 임차인의 전세보증금반환보증 가입을 전제로 하며, 임대인 또는 주택의 사유로 가입이 거절될 경우 계약은 무효로 하고 임대인은 수령 금원 전액을 즉시 반환한다.", None),
        ("cl_tax_none", "임대인은 국세·지방세 체납 사실이 없음을 확인하며, 잔금 지급일 이전에 체납 또는 압류가 확인되면 임차인은 계약을 해제할 수 있다.", None),
    ],
    hs_override={
        "hs_address": {"explain": "다가구는 건물 전체가 등기 하나라 등기부에 호수가 없어요. 전입신고는 지번(도로명)까지가 기본이고, 호수를 적는다면 현관 표시와 일치시키세요. 대장상 호수가 없는 '쪼개진 방'은 위험해요.", "documentId": "doc_building"},
        "hs_senior_fixed_date": {"level": "critical", "explain": "다가구 계약의 핵심 칸이에요. 이 예시는 선순위 6건, 합계 6억 3천만 원이라고 적혀 있어요. 근저당 3억 원까지 더하면 이미 시세 9억 원을 넘어요.", "documentId": "doc_fixeddate"},
        "hs_deposit": {"explain": "내 보증금 1억 2천만 원은 선순위 6억 3천만 원 + 근저당 3억 원 뒤에 서요. 합계 10억 5천만 원으로 시세 9억 원의 117%예요.", "calculatorId": "calc_jeonse_ratio"},
        "hs_building_use": {"explain": "건축물대장상 4층은 1가구로 허가됐는데 현장 호수는 3개예요. 방 쪼개기가 의심돼요.", "level": "critical", "documentId": "doc_building"},
    },
    hs_extra=[
        {"id": "hs_multi_disclose", "level": "critical", "title": "선순위 보증금 고지 특약", "explain": "임대인이 말한 선순위 보증금이 사실과 다르면 해제할 수 있도록 금액을 숫자로 박아두는 특약이에요. 그러나 금액이 사실이어도 이 집은 이미 위험해요. 특약은 '거짓말'을 막을 뿐 '위험한 숫자'를 바꾸지 못해요.", "lessonIds": ["ls_03_03"], "documentId": "doc_fixeddate"}
    ],
    tour=["hs_building_use", "hs_address", "hs_senior_fixed_date", "hs_deposit", "hs_multi_disclose", "hs_deposit_account", "hs_special_terms"],
    verdict={"level": "red", "title": "등기부보다 무서운 '보이지 않는 빚'",
             "points": ["선순위 보증금 6억 3천만 원 + 근저당 3억 원 = 시세 초과", "허가 가구수보다 많은 호수(쪼개기 의심)", "보증보험 가입 가능성 매우 낮음 → 계약하지 않는 것이 안전"]},
    house="MULTI_FAMILY",
)

# ---------- 3. 오피스텔 보증금 있는 월세 ----------
office = make(
    "contract_officetel_monthly_01", "오피스텔 월세", "오피스텔 보증금 있는 월세 계약서 예시",
    "보증금 5천만 원 · 월세 70만 원 · 관리비 정액 15만 원 — 소액임차인 보호와 관리비·전입신고 체크",
    {"marketPrice": 230000000, "officialPrice": 150000000, "seniorDebt": 90000000, "documentIds": ["doc_building", "doc_explain"],
     "calc": {"explain": "보증금 5천만 원 + 근저당 9천만 원 = 1억 4천만 원(시세 대비 61%). 과밀억제권역 소액임차인 기준(1억 4,500만 원 이하)에 해당해 최우선변제 최대 4,800만 원 대상(선순위 담보 설정일 기준 확인 필요)."}},
    {
        "leaseKind": "☐ 전세  ☑ 보증금 있는 월세  ☐ 월세",
        "parties": "임대인 오피스 와 임차인 이지킴 은 아래와 같이 임대차 계약을 체결한다.",
        "address": "경기도 수원시 영통구 연습대로 300",
        "land": "지목: 대 / 대지권 면적: 6.80㎡",
        "building": "구조·용도: 철근콘크리트구조 업무시설(오피스텔) / 전용면적: 29.40㎡",
        "leasedPart": "샘플타워 제15층 제1512호 전부 / 29.40㎡",
        "taxArrears": "☑ 없음 (임대인 서명: 오피스 ㊞)  ☐ 있음",
        "seniorFixedDate": "☑ 해당 없음 (임대인 서명: 오피스 ㊞)  ☐ 해당 있음",
        "deposit": "금 오천만원정 (₩50,000,000)",
        "downPayment": "금 오백만원정(₩5,000,000)은 계약 시 지불하고 영수함. 영수자: 오피스 ㊞",
        "balance": "금 사천오백만원정(₩45,000,000)은 2026년 11월 30일에 지불한다.",
        "rent": "월 금 칠십만원정(₩700,000)은 매월 30일에 지불한다(후불). 입금계좌: 가상은행 444-4444-4444 (예금주: 오피스)",
        "maintenanceFee": "정액 월 150,000원 — 포함: 일반관리비 60,000 / 공용전기 20,000 / 청소·경비 35,000 / 승강기 15,000 / 인터넷·TV 20,000. 세대 전기·가스·수도는 사용량에 따라 임차인 부담",
        "account": "가상은행 444-4444-4444 (예금주: 오피스)",
        "period": "임대인은 임차주택을 2026년 11월 30일까지 임차인에게 인도하고, 임대차기간은 인도일로부터 2027년 11월 29일까지(1년)로 한다.",
        "repair": "☐ 있음  ☑ 없음",
        "contractDate": "2026년 11월 9일",
        "lessor": "주소: (등기부상 주소와 동일) / 성명: 오피스 ㊞ / 연락처: 010-0000-0000",
    },
    [
        ("cl_moving_in_free", "임차인은 잔금 지급일에 전입신고 및 확정일자를 받을 수 있으며, 임대인은 이를 제한하거나 방해하지 않는다. 임대인의 주택임대사업자·부가가치세 사정은 임차인의 전입신고를 제한하는 사유가 되지 않는다.", "hs_off_movein"),
        ("cl_no_mortgage_until_next_day", "임대인은 잔금 지급일 다음 날까지 본 호실에 담보권을 설정하지 않으며 권리변동을 일으키지 않는다. 위반 시 임차인은 계약을 해제할 수 있다.", None),
        ("cl_maintenance_fee", "관리비는 월 정액 150,000원으로 하며 포함 항목은 위 제1조에 적은 바와 같다. 임대인은 계약기간 중 관리비 정액을 일방적으로 인상하지 않는다.", "hs_off_fee"),
        ("cl_restore_scope", "통상적인 사용에 따른 자연 마모는 원상복구 대상에서 제외하며, 원상복구 범위는 입주 시 양 당사자가 확인한 사진을 기준으로 한다.", None),
        ("cl_tax_none", "임대인은 국세·지방세 체납 사실이 없음을 확인하며, 잔금 지급일 이전에 체납 또는 압류가 확인되면 임차인은 계약을 해제할 수 있다.", None),
    ],
    hs_override={
        "hs_lease_kind": {"explain": "'보증금 있는 월세'에 체크돼 있어요. 월세 계약도 보증금이 있으면 대항력·확정일자·최우선변제가 똑같이 중요해요."},
        "hs_building_use": {"level": "critical", "title": "업무시설(오피스텔)", "explain": "오피스텔은 건축물대장상 '업무시설'이에요. 실제로 주거로 쓰고 전입신고를 하면 주택임대차보호법 보호를 받을 수 있어요. 전입신고를 못 하게 하는 계약은 피하세요.", "documentId": "doc_building"},
        "hs_deposit": {"explain": "보증금 5천만 원은 과밀억제권역 소액임차인 기준(1억 4,500만 원 이하)에 들어가요. 대항력을 갖추면 경매 때 최대 4,800만 원을 먼저 받을 수 있어요(선순위 담보 설정일 기준 확인)."},
        "hs_period": {"explain": "1년으로 정해도 임차인은 2년을 주장할 수 있어요. 1년 뒤 나가는 것도 임차인이 선택할 수 있어요."},
        "hs_maintenance": {"level": "important", "explain": "정액 15만 원과 항목별 금액이 적혀 있어요. 월세를 낮추고 관리비를 올리는 '편법 월세'를 막으려면 항목을 꼭 적어야 해요."},
    },
    hs_extra=[
        {"id": "hs_off_rent", "level": "important", "title": "월세(차임)", "explain": "지급일·선불/후불·입금 계좌(소유자 명의)를 적어요. 월세를 2기(두 달치) 이상 밀리면 임대인이 계약을 해지할 수 있어요.", "check": ["입금 계좌 예금주 = 소유자", "지급일·후불 여부"]},
        {"id": "hs_off_movein", "level": "critical", "title": "전입신고 보장 특약", "explain": "일부 오피스텔 임대인은 세금 문제로 '전입신고 금지'를 요구해요. 전입신고를 못 하면 대항력도, 최우선변제도 없어요. 반대로 '전입신고 보장' 특약을 넣으세요.", "redFlags": ["'전입신고 하지 않는다'는 특약", "'사업자 등록 때문에 전입 불가'라는 설명"]},
        {"id": "hs_off_fee", "level": "important", "title": "관리비 정액 고정 특약", "explain": "계약 중 관리비를 마음대로 올리지 못하게 하는 특약이에요. 2024년 7월부터 중개사도 관리비 총액·항목·부과방식을 확인설명서에 적어야 해요.", "documentId": "doc_explain"}
    ],
    field_hs={"rent": "hs_off_rent"},
    tour=["hs_lease_kind", "hs_building_use", "hs_deposit", "hs_off_rent", "hs_maintenance", "hs_off_movein", "hs_period", "hs_deposit_account"],
    verdict={"level": "green", "title": "월세 계약의 기본기를 갖춘 예시",
             "points": ["전입신고 보장 특약으로 대항력·최우선변제 확보", "관리비 항목 명시·인상 제한", "보증금 소액 → 최우선변제 대상(설정일 기준 확인)"]},
    house="OFFICETEL", lease="MONTHLY",
)

data["samples"] += [villa, multi, office]

# ---------- 위험 찾기 문제 추가 ----------
data["trapExercises"] = [t for t in data["trapExercises"] if t["id"] == "trap_01"]
data["trapExercises"][0]["label"] = "아파트 전세 — 6군데"
data["trapExercises"].append({
    "id": "trap_02",
    "label": "오피스텔 월세 — 독소조항 5군데",
    "title": "독소조항 찾기 — 5군데를 찾아보세요",
    "baseSampleId": "contract_officetel_monthly_01",
    "instruction": "임대인에게만 유리하게 바뀐 '독소조항' 버전입니다. 위험한 칸을 눌러보세요.",
    "overrides": [
        {"fieldKey": "sp1", "value": "임차인은 임대인의 사업자 사정으로 주민등록 전입신고를 하지 않으며, 이로 인한 불이익은 임차인이 부담한다.", "isTrap": True, "answer": "전입신고를 못 하면 대항력·우선변제권·최우선변제가 모두 없어요. 가장 치명적인 독소조항이에요.", "hotspotId": "hs_off_movein"},
        {"fieldKey": "maintenanceFee", "value": "정액 월 250,000원 (항목은 관리사무소 기준에 따름)", "isTrap": True, "answer": "관리비가 크고 항목이 없어요. 월세를 낮춘 척 관리비로 받는 편법일 수 있어요.", "hotspotId": "hs_maintenance"},
        {"fieldKey": "rent", "value": "월 금 칠십만원정(₩700,000)은 매월 1일에 선불로 지불한다. 입금계좌: 가상은행 555-5555-5555 (예금주: 오관리)", "isTrap": True, "answer": "월세 입금 계좌 예금주가 소유자가 아니에요. 소유자 명의 계좌로 바꿔야 해요.", "hotspotId": "hs_off_rent"},
        {"fieldKey": "sp4", "value": "임차인은 퇴거 시 사용 기간과 관계없이 도배·장판 전체를 새로 시공하여 반환한다.", "isTrap": True, "answer": "자연 마모까지 임차인에게 떠넘기는 과도한 원상복구 조항이에요.", "hotspotId": "hs_special_terms"},
        {"fieldKey": "sp2", "value": "임차인은 계약기간 중 중도 해지 시 잔여 기간 월세 전액을 위약금으로 지급한다.", "isTrap": True, "answer": "중도 해지 위약금이 지나치게 커요. 보통은 새 임차인 중개보수 부담 정도로 협의해요.", "hotspotId": "hs_special_terms"}
    ],
    "decoys": ["deposit", "period", "contractDate"],
    "scoring": {"perCorrect": 10, "perWrongTap": -2, "passScore": 40}
})

path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("samples:", [s["id"] for s in data["samples"]], "traps:", len(data["trapExercises"]))
