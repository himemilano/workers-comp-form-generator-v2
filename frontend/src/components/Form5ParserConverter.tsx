import React, { useState } from "react";

const LABEL_TO_KEY: Record<string, string> = {
  "性別": "sex",
  "生年月日の和暦": "Date_of_birth,Japanese_era",
  "生年月日": "date_of_birth",
  "負傷年月日": "Date_of_injury",
  "氏名フリガナ": "Name_in_Katakana",
  "氏名(漢字)": "worker_name",
  "氏名": "worker_name",
  "年齢": "age",
  "本人郵便番号": "zip_code",
  "住所都道府県フリガナ": "Personal_address_and_prefecture,and_phonetic_spelling",
  "住所都道府県": "Personal_address_and_prefecture",
  "住所市町村以降フリガナ": "Personal_address_in_kana",
  "住所市町村以降": "Personal_address",
  "職種": "Job_type",
  "負傷時刻区分": "disaster_time_type",
  "負傷時刻(時)": "disaster_hour",
  "負傷時刻(分)": "disaster_minute",
  "災害の原因と発生状況": "accident_detail",
  "診療を受けた病院名": "Hospital_name",
  "診療を受けた病院住所": "Hospital_Address",
  "病院電話番号": "Hospital_tel",
  "病院郵便番号": "Hospital_zip",
  "傷病の部位及び状態": "Location_and_condition_of_the_injury",
  "記入日": "date_of_entry",
  "本人電話番号": "claimant_tel",
  "労働保険番号": "Labor_insurance_No.",
  "負傷を確認した人の職名": "itle_of_the_person_verifying_the_facts",
  "負傷を確認した人の氏名": "Name_of_the_person_who_confirmed_the_facts",
  "提出する会社名": "Company_Name",
  "提出する会社住所": "Company_Address",
  "代表者氏名": "Representative's_name",
  "会社証明日": "date_of_proof",
  "会社電話番号": "Company_tel",
  "会社郵便番号": "Company_zip",
  "本人の所属会社が上記と異なる場合": "Company_name_and_representative's_name",
  "所属会社が上記と異なる場合": "Company_name_and_representative's_name",
  "上記所属会社電話番号": "affiliated_company_tel",
  "所轄労基署エリア": "Area_of_the_Labor_Standards_Inspection_Office",
  "その他就業先が有る場合": "Multiple",
  "表面以外の就業先の数": "Number_of_workplaces",
  "特別加入の労働保険番号": "Special_Insurance_num",
  "労働保険事務組合等の名称": "Name_of_Special_Member_Organization",
  "特別加入日": "date_of_joining",
};

const matchKeyFromLabel = (label: string): string | null => {
  const cleanLabel = label.trim();
  if (LABEL_TO_KEY[cleanLabel]) return LABEL_TO_KEY[cleanLabel];
  for (const [keyLabel, jsonKey] of Object.entries(LABEL_TO_KEY)) {
    if (cleanLabel.startsWith(keyLabel) || keyLabel.startsWith(cleanLabel)) {
      return jsonKey;
    }
  }
  return null;
};

const splitKatakanaDakuon = (str: string): string[] => {
  const result: string[] = [];
  const normalized = str.normalize("NFD");
  for (const char of normalized) {
    if (char === "\u3099") result.push("゛");
    else if (char === "\u309A") result.push("゜");
    else result.push(char);
  }
  return result;
};

/**
 * 自由記入欄用の和暦日付パース関数
 * 「令和8年8月19日」「R8.8.19」などから
 * { year: "令和8", month: "8", day: "19" } を抽出（ゼロ埋めなし・元号付き）
 */
const parseJapaneseDate = (dateStr: string): { year: string; month: string; day: string } | null => {
  if (!dateStr) return null;

  // 元号の自動判定（指定なし・Rは「令和」、Hは「平成」、Sは「昭和」、Tは「大正」）
  let era = "令和";
  const upperStr = dateStr.toUpperCase();
  if (dateStr.includes("平成") || upperStr.includes("H")) era = "平成";
  else if (dateStr.includes("昭和") || upperStr.includes("S")) era = "昭和";
  else if (dateStr.includes("大正") || upperStr.includes("T")) era = "大正";
  else if (dateStr.includes("令和") || upperStr.includes("R")) era = "令和";

  // 数字のみを抽出
  const matches = dateStr.match(/\d+/g);
  if (matches && matches.length >= 3) {
    const yearNum = parseInt(matches[0], 10);
    const monthNum = parseInt(matches[1], 10);
    const dayNum = parseInt(matches[2], 10);

    return {
      year: `${era}${yearNum}`, // 例: "令和8"
      month: String(monthNum),  // 例: "8"（ゼロ埋めなし）
      day: String(dayNum),      // 例: "19"（ゼロ埋めなし）
    };
  }
  return null;
};

export const Form5ParserConverter: React.FC = () => {
  const [rawText, setRawText] = useState<string>("");
  const [parsedJson, setParsedJson] = useState<Record<string, any>>({});
  const [katakanaArray, setKatakanaArray] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleParse = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedJson({});
      setKatakanaArray([]);
      return;
    }

    const lines = text.split("\n");
    const temp: Record<string, string> = {};
    let currentJsonKey: string | null = null;

    for (const line of lines) {
      const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
      if (match) {
        const rawLabel = match[1].trim();
        const value = match[2].trim();
        const jsonKey = matchKeyFromLabel(rawLabel);

        if (jsonKey) {
          currentJsonKey = jsonKey;
          if (value) temp[jsonKey] = value;
        } else {
          currentJsonKey = null;
        }
      } else if (currentJsonKey && line.trim() && !line.startsWith("---") && !line.startsWith("■")) {
        if (temp[currentJsonKey]) {
          temp[currentJsonKey] += "\n" + line.trim();
        } else {
          temp[currentJsonKey] = line.trim();
        }
      }
    }

    const finalJson: Record<string, any> = {};

    const setIfValid = (key: string, val: any) => {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        finalJson[key] = val;
      }
    };

    setIfValid("Labor_insurance_No.", temp["Labor_insurance_No."]);
    setIfValid("sex", temp["sex"]);
    setIfValid("Date_of_birth,Japanese_era", temp["Date_of_birth,Japanese_era"]);
    setIfValid("date_of_birth", temp["date_of_birth"]);
    setIfValid("Date_of_injury", temp["Date_of_injury"]);

    if (temp["Name_in_Katakana"]) {
      const splitChars = splitKatakanaDakuon(temp["Name_in_Katakana"]);
      const slicedChars = splitChars.slice(0, 16);
      setKatakanaArray(slicedChars);
      finalJson["Name_in_Katakana"] = slicedChars.join("");
    } else {
      setKatakanaArray([]);
    }

    setIfValid("worker_name", temp["worker_name"]);
    setIfValid("age", temp["age"]);

    if (temp["zip_code"] && temp["zip_code"].includes("-")) {
      const [first, last] = temp["zip_code"].split("-");
      setIfValid("zip_first", first);
      setIfValid("zip_last", last);
    }

    setIfValid("Personal_address_and_prefecture,and_phonetic_spelling", temp["Personal_address_and_prefecture,and_phonetic_spelling"]);
    setIfValid("Personal_address_and_prefecture", temp["Personal_address_and_prefecture"]);
    setIfValid("Personal_address_in_kana", temp["Personal_address_in_kana"]);
    setIfValid("Personal_address", temp["Personal_address"]);
    setIfValid("Job_type", temp["Job_type"]);

    if (temp["disaster_time_type"] === "AM") finalJson["time_am"] = true;
    else if (temp["disaster_time_type"] === "PM") finalJson["time_pm"] = true;

    setIfValid("disaster_hour", temp["disaster_hour"]);
    setIfValid("disaster_minute", temp["disaster_minute"]);
    setIfValid("itle_of_the_person_verifying_the_facts", temp["itle_of_the_person_verifying_the_facts"]);
    setIfValid("Name_of_the_person_who_confirmed_the_facts", temp["Name_of_the_person_who_confirmed_the_facts"]);
    setIfValid("accident_detail", temp["accident_detail"]);

    setIfValid("Hospital_name", temp["Hospital_name"]);
    setIfValid("Hospital_Address", temp["Hospital_Address"]);

    if (temp["Hospital_tel"] && temp["Hospital_tel"].includes("-")) {
      const parts = temp["Hospital_tel"].split("-");
      setIfValid("Hospital_tel_area", parts[0]);
      setIfValid("Hospital_tel_city", parts[1]);
      setIfValid("Hospital_tel_num", parts[2]);
    }
    if (temp["Hospital_zip"] && temp["Hospital_zip"].includes("-")) {
      const [hF, hL] = temp["Hospital_zip"].split("-");
      setIfValid("Hospital_zip_first", hF);
      setIfValid("Hospital_zip_last", hL);
    }

    setIfValid("Location_and_condition_of_the_injury", temp["Location_and_condition_of_the_injury"]);

    setIfValid("Company_Name", temp["Company_Name"]);
    setIfValid("Company_Address", temp["Company_Address"]);
    setIfValid("Representative's_name", temp["Representative's_name"]);

    // 会社証明日の分解 (例: "令和8年8月30日" -> Year: "令和8", Month: "8", Day: "30")
    if (temp["date_of_proof"]) {
      const d = parseJapaneseDate(temp["date_of_proof"]);
      if (d) {
        setIfValid("Year_of_proof_of_fact", d.year);
        setIfValid("Month_of_Proof_of_Fact", d.month);
        setIfValid("The_day_of_proof_of_facts", d.day);
      }
    }

    if (temp["Company_tel"] && temp["Company_tel"].includes("-")) {
      const cTel = temp["Company_tel"].split("-");
      setIfValid("Company_tel_area", cTel[0]);
      setIfValid("Company_tel_city", cTel[1]);
      setIfValid("Company_tel_num", cTel[2]);
    }

    if (temp["Company_zip"] && temp["Company_zip"].includes("-")) {
      const [cZF, cZL] = temp["Company_zip"].split("-");
      setIfValid("Company_zip_first", cZF);
      setIfValid("Company_zip_last", cZL);
    }

    setIfValid("Company_name_and_representative's_name", temp["Company_name_and_representative's_name"]);
    if (temp["affiliated_company_tel"] && temp["affiliated_company_tel"].includes("-")) {
      const aTel = temp["affiliated_company_tel"].split("-");
      setIfValid("The_person's_affiliated_company_tel_area", aTel[0]);
      setIfValid("The_person's_affiliated_company_tel_city", aTel[1]);
      setIfValid("The_person's_affiliated_company_tel_num", aTel[2]);
    }

    setIfValid("Area_of_the_Labor_Standards_Inspection_Office", temp["Area_of_the_Labor_Standards_Inspection_Office"]);

    // 記入日の分解 (例: "令和8年8月30日" -> Year: "令和8", Month: "8", Day: "30")
    if (temp["date_of_entry"]) {
      const d = parseJapaneseDate(temp["date_of_entry"]);
      if (d) {
        setIfValid("Year_of_entry", d.year);
        setIfValid("onth_of_entry", d.month);
        setIfValid("Date_of_entry", d.day);
      }
    }

    if (temp["claimant_tel"] && temp["claimant_tel"].includes("-")) {
      const clTel = temp["claimant_tel"].split("-");
      setIfValid("claimant_tel_area", clTel[0]);
      setIfValid("claimant_tel_city", clTel[1]);
      setIfValid("claimant_tel_num", clTel[2]);
    }

    if (temp["Multiple"] === "有") {
      finalJson["Multiple"] = "有";
    }
    setIfValid("Number_of_workplaces", temp["Number_of_workplaces"]);
    setIfValid("Special_Insurance_num", temp["Special_Insurance_num"]);
    setIfValid("Name_of_Special_Member_Organization", temp["Name_of_Special_Member_Organization"]);

    // 特別加入日の分解 (例: "令和5年4月1日" -> Year: "令和5", Month: "4", Day: "1")
    if (temp["date_of_joining"]) {
      const d = parseJapaneseDate(temp["date_of_joining"]);
      if (d) {
        setIfValid("Year_of_joining", d.year);
        setIfValid("Joining_Month", d.month);
        setIfValid("Joining_date", d.day);
      }
    }

    finalJson["Date_of_injury,Japanese_era"] = "9";

    if (finalJson["zip_first"]) finalJson["claimant_zip_first"] = finalJson["zip_first"];
    if (finalJson["zip_last"]) finalJson["claimant_zip_last"] = finalJson["zip_last"];

    const pref = finalJson["Personal_address_and_prefecture"] || "";
    const addr = finalJson["Personal_address"] || "";
    if (pref || addr) {
      finalJson["Claimant's_address"] = `${pref}${addr}`;
    }

    if (finalJson["worker_name"]) {
      finalJson["Claimant's_name"] = finalJson["worker_name"];
    }

    if (finalJson["Hospital_name"]) {
      const extracted = finalJson["Hospital_name"].replace(/(病院|診療所|クリニック|医院)$/, "");
      finalJson["Claim_Hospital_name"] = extracted;
    }

    setParsedJson(finalJson);
  };

  const copyJsonToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(parsedJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        労災様式第5号 返信テキスト一括変換コンバーター (表・裏面対応)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              📥 返信テキストをここに貼り付け
            </label>
            <textarea
              value={rawText}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="LINEやメールの返信文面をそのまま貼り付けてください..."
              rows={22}
              className="w-full p-3 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          {katakanaArray.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-bold text-slate-600 block mb-2">
                🔤 カタカナ濁点分離プレビュー（全16マス）
              </span>
              <div className="flex flex-wrap gap-1">
                {katakanaArray.map((char, index) => (
                  <div
                    key={index}
                    className="w-7 h-8 border border-blue-400 bg-blue-50 flex items-center justify-center font-bold text-sm rounded text-blue-900"
                  >
                    {char}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
              <span className="text-xs font-mono font-bold text-green-400">
                ⚡ 自動変換された JSON (表・裏面統合)
              </span>
              <button
                onClick={copyJsonToClipboard}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition"
              >
                {copied ? "✓ コピー完了" : "JSONをコピー"}
              </button>
            </div>
            <pre className="text-xs font-mono bg-slate-950 p-3 rounded overflow-x-auto max-h-[500px] text-slate-300">
              {JSON.stringify(parsedJson, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form5ParserConverter;