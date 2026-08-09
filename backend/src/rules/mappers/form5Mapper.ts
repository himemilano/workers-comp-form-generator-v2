/**
 * --- ユーティリティ関数群 ---
 */

// 全角英数字を半角に変換し、記号を除去
function toHalfWidth(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9a-zA-Z]/g, "");
}

// キーから「:」より後ろの値を安全に取得
function getVal(rawInput: Record<string, string>, key: string): string {
  const raw = rawInput[key] || "";
  if (!raw) return "";
  const colonIndex = Math.max(raw.indexOf("："), raw.indexOf(":"));
  const value = colonIndex !== -1 ? raw.substring(colonIndex + 1) : raw;
  return value.trim();
}

// 1. マス目（OCR枠）用：指定桁数へゼロ埋め・フォーマット
function padGridValue(val: string, length: number): string {
  const clean = toHalfWidth(val);
  if (!clean) return "".padStart(length, " ");
  return clean.padStart(length, "0").slice(-length);
}

// 2. 電話番号の市外局番・市内局番・番号への確実な3分割
function parsePhone(phoneStr: string): { area: string; city: string; num: string } {
  const clean = phoneStr.replace(/[^\d-]/g, "");
  const parts = clean.split("-");
  if (parts.length === 3) {
    return { area: parts[0], city: parts[1], num: parts[2] };
  }
  // ハイフンがない場合のフォールバック（桁数推測）
  const digits = toHalfWidth(phoneStr);
  if (digits.length === 10) {
    return { area: digits.slice(0, 3), city: digits.slice(3, 6), num: digits.slice(6) };
  } else if (digits.length === 11) {
    return { area: digits.slice(0, 3), city: digits.slice(3, 7), num: digits.slice(7) };
  }
  return { area: digits, city: "", num: "" };
}

// 3. 郵便番号の分割 (3桁 - 4桁)
function parseZip(zipStr: string): { first: string; last: string } {
  const digits = toHalfWidth(zipStr);
  return {
    first: digits.slice(0, 3),
    last: digits.slice(3, 7)
  };
}

// 4. 日本語日付テキストの完全分解（和暦・西暦・数字のみ形式に柔軟対応）
function parseFlexibleDate(dateStr: string): { year: string; month: string; day: string } {
  if (!dateStr) return { year: "", month: "", day: "" };

  const digits = toHalfWidth(dateStr);
  
  // 6桁数字（例: 080829 -> 08年08月29日 / 550515 -> 55年05月15日）
  if (/^\d{6}$/.test(digits)) {
    return {
      year: digits.slice(0, 2),
      month: digits.slice(2, 4),
      day: digits.slice(4, 6)
    };
  }

  // 漢字表記（例: 令和8年7月29日, 昭和55年5月15日）
  const matches = dateStr.match(/(?:昭和|平成|令和)?\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (matches) {
    return {
      year: matches[1].padStart(2, "0"),
      month: matches[2].padStart(2, "0"),
      day: matches[3].padStart(2, "0")
    };
  }

  return { year: "", month: "", day: "" };
}

// 5. 長文自動折返しロジック（枠幅を超過したテキストへ指定文字数ごとに\nを挿入）
function wrapText(text: string, maxCharsPerLine: number = 30): string {
  if (!text) return "";
  // 既存の改行を取り払い、指定文字数ごとに \n を挟む
  const cleanText = text.replace(/\r?\n/g, "");
  const regex = new RegExp(`.{1,${maxCharsPerLine}}`, "g");
  const lines = cleanText.match(regex);
  return lines ? lines.join("\n") : cleanText;
}

/**
 * --- メインマッパー関数 ---
 */
export function buildForm5Data(
  rawInput: Record<string, string>,
  _fillAllForTest: boolean = false
): Record<string, string> {
  const v = (key: string) => getVal(rawInput, key);

  // --- A. 労働保険番号（OCRマス目用：14桁完全フォーマット） ---
  const pref         = padGridValue(v("労働保険番号_府県(2桁)"), 2);
  const jurisdiction = padGridValue(v("労働保険番号_所掌(1桁)"), 1);
  const office       = padGridValue(v("労働保険番号_管轄(2桁)"), 2);
  const basic        = padGridValue(v("労働保険番号_基幹番号(6桁)"), 6);
  const branch       = padGridValue(v("労働保険番号_枝番号(3桁)"), 3);
  const fullLaborIns = `${pref}${jurisdiction}${office}${basic}${branch}`;

  // --- B. 郵便番号・電話番号（本人・病院/薬局・会社・所属会社） ---
  const workerZip    = parseZip(v("本人郵便番号(例: 123-4567)"));
  const workerPhone  = parsePhone(v("本人電話番号(例: 090-1234-5678)"));

  const hospZipRaw   = v("診療を受けた病院郵便番号(例: 100-0001)") || v("薬局の郵便番号(例: 100-0001)");
  const hospZip      = parseZip(hospZipRaw);

  const hospPhoneRaw = v("病院電話番号(例: 03-1234-5678)") || v("薬局の電話番号(例: 03-1234-5678)");
  const hospPhone    = parsePhone(hospPhoneRaw);

  const compZip      = parseZip(v("証明会社郵便番号(例: 604-8130)"));
  const compPhone    = parsePhone(v("証明会社電話番号(例: 075-221-8800)"));
  const affCompPhone = parsePhone(v("その会社の電話番号(例: 075-222-3333)"));

  // --- C. 日付パース ---
  const birthYmd       = parseFlexibleDate(v("生年月日(例: 55年5月15日→550515)"));
  const injuryYmd      = parseFlexibleDate(v("負傷年月日(例: 令和8年8月29日→080829)"));
  const proofDateYmd   = parseFlexibleDate(v("事業主証明年月日(例: 令和8年7月29日)"));
  const fillDateYmd    = parseFlexibleDate(v("記入日(例: 令和8年8月30日)"));
  const joiningDateYmd = parseFlexibleDate(v("特別加入日(例: 令和5年4月1日)"));

  // 負傷時刻
  const rawTimeType = v("負傷時刻区分(AM または PM)");
  const isAM = rawTimeType.toUpperCase().includes("AM");
  const isPM = rawTimeType.toUpperCase().includes("PM");

  // 病院名・住所
  const hospName    = v("診療を受けた病院名") || v("調剤を受けた薬局名");
  const hospAddress = v("診療を受けた病院住所") || v("薬局の住所");

  // 住所結合
  const prefStr     = v("住所都道府県");
  const cityStr     = v("住所市町村以降");
  const fullAddress = prefStr + cityStr;
  const workerName  = v("氏名(漢字)");

  // 管轄労働基準監督署（末尾調整）
  let inspectorateOffice = v("管轄労働基準監督署名(例: 京都南)");
  if (inspectorateOffice && !inspectorateOffice.endsWith("労働基準監督署")) {
    inspectorateOffice += "労働基準監督署";
  }

  // その他就業先フラグ
  const multipleRaw = v("その他就業先が有る場合(有と入力、無ければ空欄)");
  const multipleMark = multipleRaw === "有" ? "〇" : "";

  // --- D. 長文テキストの折返し処理（1行あたりの文字数を指定） ---
  const wrappedAccidentDetail = wrapText(v("災害の原因と発生状況"), 30); // 30文字毎に改行
  const wrappedInjuryStatus   = wrapText(v("傷病の部位及び状態"), 25);   // 25文字毎に改行
  const wrappedCompanyAddr    = wrapText(v("証明会社住所(事業場の所在地)"), 28);

  // --- E. JSON ID への一括マッピング ---
  return {
    // 【表面：マス目OCR項目】
    "Labor_insurance_No.": fullLaborIns,
    "sex": v("性別(男性は1、女性は3)"),
    "Date_of_birth,Japanese_era": v("生年月日の和暦(昭和5, 平成7, 令和9)"),
    "date_of_birth": `${birthYmd.year}${birthYmd.month}${birthYmd.day}`,
    "Date_of_injury,Japanese_era": "9", // 令和固定
    "Date_of_injury": `${injuryYmd.year}${injuryYmd.month}${injuryYmd.day}`,
    "Name_in_Katakana": v("氏名フリガナ(全角カタカナ・姓と名の間にスペース)").slice(0, 16),
    "worker_name": workerName,
    "age": toHalfWidth(v("年齢(数字のみ)")),

    // 本人郵便番号（マス目）
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,

    // 本人住所
    "Personal_address_and_prefecture,and_phonetic_spelling": v("住所都道府県フリガナ"),
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": v("住所市町村以降フリガナ"),
    "Personal_address": cityStr,
    "Job_type": v("職種"),

    // 負傷時刻
    "time_am": isAM ? "〇" : "",
    "time_pm": isPM ? "〇" : "",
    "disaster_hour": toHalfWidth(v("負傷時刻(時)")),
    "disaster_minute": toHalfWidth(v("負傷時刻(分)")),

    // 災害原因（長文折返し適用）
    "accident_detail": wrappedAccidentDetail,

    // 病院情報
    "Hospital_name": hospName,
    "Hospital_Address": hospAddress,
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Location_and_condition_of_the_injury": wrappedInjuryStatus,

    // 会社証明欄（日付・電話番号補填）
    "Company_Name": v("証明会社名(事業の名称)"),
    "Company_Address": wrappedCompanyAddr,
    "Representative's_name": v("代表者職氏名(例: 代表取締役 山田 太郎)"),
    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    // 所属会社欄（異なる場合）
    "Company_name_and_representative's_name": v("所属事業場の名称・所在地"),
    "The_person's_affiliated_company_tel_area": affCompPhone.area,
    "The_person's_affiliated_company_tel_city": affCompPhone.city,
    "The_person's_affiliated_company_tel_num": affCompPhone.num,

    // 請求人欄（日付・電話・住所・氏名・病院名の補填）
    "Area_of_the_Labor_Standards_Inspection_Office": inspectorateOffice,
    "Claim_Hospital_name": hospName,
    "claimant_zip_first": workerZip.first,
    "claimant_zip_last": workerZip.last,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,

    // 【裏面】
    "Multiple": multipleMark,
    "Number_of_workplaces": toHalfWidth(v("表面以外の就業先の数(数字のみ)")),
    "Special_Insurance_num": padGridValue(v("特別加入の労働保険番号"), 14),
    "Name_of_Special_Member_Organization": v("労働保険事務組合等の名称"),
    "Year_of_joining": joiningDateYmd.year,
    "Joining_Month": joiningDateYmd.month,
    "Joining_date": joiningDateYmd.day
  };
}
