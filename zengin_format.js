(() =>{
  "use strict";

  /**
   * ============================================================
   * 全銀フォーマット（総合振込）ver 1.0.5
   * 
   * JavaScript版
   * 1レコード = 120バイト
   * 文字コード = Shift_JIS
   * 改行 = CRLF
   *
   * 処理の流れ 手順の流れ
   * 1. ヘッダーレコード作成
   * 2. データレコード作成
   * 3. トレーラーレコード作成
   * 4. エンドレコード作成
   * 5. 各レコードを120文字チェック
   * 6. Shift_JISへ変換
   * 7. 各レコードを120バイトチェック
   * 8. CRLFで結合
   * 9. TXTファイルとしてダウンロード
   * ============================================================
   */
  /* ============================================================
   * 基本設定
   * ==========================================================*/
  let CONFIG = {
    BUTTON_ID:'button_id_class',
    RECORD_BYTES: 120,//固定長120制限
    TYPE_CODE: "21",//依頼人側の口座コード
    ENCODING: "SJIS",//指定バイトコード
    LINE_BREAK: "\r\n",//CRLFで結合用
    DEFAULT_FILE_NAME: "zengin_sogofurikomi.txt",//出力ファイル名
    ZIP_FILE_NAME:"zengin_zipfile_sample",//全銀のファイルをzip化する時に使うもの
    //ダウンロードした日付を入れる必要がある。日付を追加
  };
  
  

  // ============================================================
  // ZIPファイルをkintoneへアップロード
  // ============================================================
  async function uploadFileZip(blob, fileName) {
      const formData = new FormData();
      formData.append('__REQUEST_TOKEN__',kintone.getRequestToken());
      formData.append('file', blob, fileName);
      //レスポンス生成
      const response = await fetch(
          kintone.api.url('/k/v1/file.json', true),
          {
            method: 'POST',
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            body: formData
          }
      );
      //エラー時の処理
      if (!response.ok) {
          throw new Error('ZIPアップロード失敗: ' + await response.text());
      }
      const result = await response.json();
  
      return result.fileKey;
  }
  
  
  // ============================================================
  // 全銀TXTをZIP化して別のアプリに登録
  // ============================================================
  async function registerZenginZip(result,header){
    //作成する日付を取得
    const downloadDate = createDateNow();
    //
    const txtFileName = 'samplez.txt';
    const zip = new JSZip();
    
    zip.file(txtFileName,result.bytes);
    //_Blob_を作成
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 6
        }
    });    
    //Zipをダウンロード
    const zipFileName = downloadDate + '_zengin_'+ header.transferDate + '.zip';
    //_zip_をkintoneへアップロードする処理
    const fileKey = await uploadFileZip(
      zipBlob,
      zipFileName
    );
    
    //リクエストパラメーター
    const params = {
      app:88,//プラグインでアプリの選択
      record:{
        "添付ファイル":{//プラグインでアプリの選択
          "value":[{"fileKey":fileKey}]
        }
      }
    };
    //新規で全銀ファイルを作成
    const response = await kintone.api(kintone.api.url('/k/v1/record.json',true),'POST',params);
    //アップロードフラグ返却
    return response;
    
  }
  
  
  
  /* ============================================================
   * 数字フィールド
   * 右詰め・ゼロ埋め
   * numericField('123', 7) → 0000123
   * ==========================================================*/
  function numericField(value, length, label) {
    let digits = String(value == null ? "" : value).replace(/[^\d]/g, "");
    //入力チェック
    if (digits === "") {
      throw new Error(label + "を入力してください。");
    }
    // 長さチェック
    if (digits.length > length) {
      throw new Error(label + "は" + length + "桁以内で入力してください。");
    }
    return digits.padStart(length, "0");//ここにスペースか0で表示するようにする形式
  }
  
  
  /*============================================================
   * 文字フィールド
   * 左詰め・スペース埋め
   * =========================================================*/
  function textField(value, length, label) {
    var text = String(value == null ? "" : value);
    //入力チェック
    if (text.length > length) {
      throw new Error(label + "は" + length + "文字以内で入力してください。");
    }
    return text.padEnd(length, " ");//ここにスペースか0で表示するようにする形式
  }
  
  
  /* ============================================================
   * ひらがな → カタカナ変換
   * ==========================================================*/
  function hiraganaToKatakana(text) {
    return text.replace(/[ぁ-ゖ]/g, function (char) {
      return String.fromCharCode(char.charCodeAt(0) + 0x60);
    });
  }
  
  /* ============================================================
   * 全角英数字・記号 → 半角変換
   * ==========================================================*/
  function fullWidthToHalfWidth(text) {
    return text.replace(/[！-～]/g, function (char) {
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    }).replace(/　/g, " ");
  }
  
  /* ============================================================
   * 全角カタカナ → 半角カタカナ
   * 濁点・半濁点の場合は以下の処理
   * ガ → ｶﾞ
   * パ → ﾊﾟ
   * ==========================================================*/
  function katakanaToHalfWidth(text) {
    var map = {
      
      //50音の場合
      ア: "ｱ",イ: "ｲ",ウ: "ｳ",エ: "ｴ",オ: "ｵ",
      カ: "ｶ",キ: "ｷ",ク: "ｸ",ケ: "ｹ",コ: "ｺ",
      サ: "ｻ",シ: "ｼ",ス: "ｽ",セ: "ｾ",ソ: "ｿ",
      タ: "ﾀ",チ: "ﾁ",ツ: "ﾂ",テ: "ﾃ",ト: "ﾄ",
      ナ: "ﾅ",ニ: "ﾆ",ヌ: "ﾇ",ネ: "ﾈ",ノ: "ﾉ",
      ハ: "ﾊ",ヒ: "ﾋ",フ: "ﾌ",ヘ: "ﾍ",ホ: "ﾎ",
      マ: "ﾏ",ミ: "ﾐ",ム: "ﾑ",メ: "ﾒ",モ: "ﾓ",
      ヤ: "ﾔ",ユ: "ﾕ",ヨ: "ﾖ",
      ラ: "ﾗ",リ: "ﾘ",ル: "ﾙ",レ: "ﾚ",ロ: "ﾛ",
      ワ: "ﾜ",ヲ: "ｦ",ン: "ﾝ",
      //拗音の場合
      ァ: "ｧ",ィ: "ｨ",ゥ: "ｩ",ェ: "ｪ",ォ: "ｫ",
      ッ: "ｯ",ャ: "ｬ",ュ: "ｭ",ョ: "ｮ",ヮ: "ﾜ",
      //記号の場合
      ー: "ｰ","。": "｡","「": "｢","」": "｣","、": "､","・": "･",
    };
    
    //濁音
    var dakuon = {
      ガ: "ｶﾞ",ギ: "ｷﾞ",グ: "ｸﾞ",ゲ: "ｹﾞ",ゴ: "ｺﾞ",
      ザ: "ｻﾞ",ジ: "ｼﾞ",ズ: "ｽﾞ",ゼ: "ｾﾞ",ゾ: "ｿﾞ",
      ダ: "ﾀﾞ",ヂ: "ﾁﾞ",ヅ: "ﾂﾞ",デ: "ﾃﾞ",ド: "ﾄﾞ",
      バ: "ﾊﾞ",ビ: "ﾋﾞ",ブ: "ﾌﾞ",ベ: "ﾍﾞ",ボ: "ﾎﾞ",
      ヴ: "ｳﾞ",
    };
    //半濁音
    var handakuon = {
      パ: "ﾊﾟ",ピ: "ﾋﾟ",プ: "ﾌﾟ",ペ: "ﾍﾟ",ポ: "ﾎﾟ",
    };

    var result = "";
    // -------------------------------------
    //条件に合ったものに変換
    // -------------------------------------
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      if (dakuon[char]) {
        result += dakuon[char];
      } else if (handakuon[char]) {
        result += handakuon[char];
      } else if (map[char]) {
        result += map[char];
      } else {
        result += char;
      }
    }
    return result;
  }

  /* ============================================================
   * 半角カナへ変換
   * =========================================================*/
  function toHalfWidthKana(value) {
    var text = String(value === null ? "" : value);
    // ひらがな → カタカナ
    text = hiraganaToKatakana(text);
    // 全角英数字 → 半角
    text = fullWidthToHalfWidth(text);
    // 全角カタカナ → 半角
    text = katakanaToHalfWidth(text);
    var result = "";
    var hasUnmappable = false;
    // 変換後アスキーコードへ変換
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      //ASCII
      if (char.charCodeAt(0) <= 0x7f) {
        result += char;
        continue;
      }
      /* 半角カナ */
      if (char >= "ｦ" && char <= "ﾟ") {
        result += char;
        continue;
      }
      /* 変換できない文字 */
      result += " ";
      hasUnmappable = true;
    }
    return {
      text: result,
      hasUnmappable: hasUnmappable,
    };
  }
  
  
  /* ============================================================
   * カナフィールド
   * 左詰め・スペース埋め
   * ==========================================================*/
  function kanaField(value, length, label, warnings) {
    //入力チェック
    if (value == null || String(value).trim() === "") {
      throw new Error(label + "を入力してください。");
    }
    var result = toHalfWidthKana(value);
    /* 変換できない文字 */
    if (result.hasUnmappable) {
      warnings.push(label +"に変換できない文字が含まれていたため、スペースに置き換えました。");
    }
    
    /* 桁数オーバー*/
    if (result.text.length > length) {
      warnings.push(label + "が" + length + "文字を超えていたため切り詰めました。");
      return result.text.substring(0, length);
    }
    return result.text.padEnd(length, " ");
  }

  /* ============================================================
   * 日付変換
   * YYYY-MM-DD → MMDD
   * ==========================================================*/
  function formatMMDD(date) {
    var value = String(date || "");
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new Error("振込指定日は YYYY-MM-DD 形式で入力してください。");
    }
    return match[2] + match[3];
  }
  /* ============================================================
   * 預金種目 3つに分類 基本は普通口座に振込する仕様
   * 1 = 普通
   * 2 = 当座
   * 4 = 貯蓄
   * ==========================================================*/
  function accountType(value) {
    var map = {
      普通: "1",普通預金: "1",
      当座: "2",当座預金: "2",
      貯蓄: "4",貯蓄預金: "4",
      その他:"9",
      1: "1",2: "2",4: "4",9:"9"
    };
    
    var key = String(value === null ? "" : value).trim();
    var result = map[key];
    //該当するvalueがない場合にエラー
    if (!result) {
      throw new Error("預金種目は「普通」「当座」「貯蓄」または 1 / 2 / 4 で指定してください。");
    }
    return result;
  }

  /* ============================================================
   * 空きエリア 長さによって空白を埋める
   * ==========================================================*/
  function blankField(length) {
    return " ".repeat(length);
  }
  
  /* ============================================================
   * 文字数チェック
   * ※このチェックは「120文字」チェック
   * ※最終的にはShift_JISの120バイトチェックも行う
   * ==========================================================*/
  function validateRecordLength(record, label) {
    if (record.length !== CONFIG.RECORD_BYTES) {
      throw new Error(
        label +
          "が" +
          CONFIG.RECORD_BYTES +
          "文字ではありません。\n" +
          "現在:" +record.length +"文字"
      );
    }
  }

  /* ============================================================
   * Shift_JISへ変換（js文字列をバイトコードへ変換）
   * ==========================================================*/
  function encodeShiftJIS(text) {
    if (typeof Encoding === "undefined") {
      throw new Error("encoding-japanese が読み込まれていません。");
    }
    var unicodeArray = Encoding.stringToCode(text);
    var sjisArray = Encoding.convert(unicodeArray, {
      to: CONFIG.ENCODING,
      from: "UNICODE",
    });
    return new Uint8Array(sjisArray);
  }

  /*　============================================================
   * バイト数チェック
   * 120文字ではなく
   * 「Shift_JISに変換した結果が120バイト」
   * であることを確認する
   * ===========================================================*/
  function validateRecordBytes(record, label) {
    var bytes = encodeShiftJIS(record);
    //固定長なので120以外は受け付けない
    if (bytes.length !== CONFIG.RECORD_BYTES) {
      throw new Error(
        label +
          "が" +
          CONFIG.RECORD_BYTES +
          "バイトではありません。\n" +
          "現在:" +
          bytes.length +
          "バイト\n\n" +
          "レコード内容:\n" +
          record
      );
    }
    return bytes;
  }

  /* ============================================================
   * ヘッダーレコード
   * 120バイト固定長
   * ==========================================================*/
  function buildHeaderRecord(header, warnings) {
    // 依頼人コード
    var clientCode = numericField(header.clientCode, 10, "委託者コード");
    // 依頼人名
    var clientName = kanaField(header.clientName, 40, "委託者名", warnings);
    // 振込指定日
    var mmdd = formatMMDD(header.transferDate);
    // 仕向銀行番号
    var bankCode = numericField(header.bankCode, 4, "仕向銀行番号");
    // 仕向銀行名
    var bankName = kanaField(header.bankName, 15, "仕向銀行名", warnings);
    //仕向支店番号
    var branchCode = numericField(header.branchCode, 3, "仕向支店番号");
    //仕向支店名
    var branchName = kanaField(header.branchName, 15, "仕向支店名", warnings);
    //口座番号
    var accountNumber = numericField(header.accountNumber, 7, "口座番号");
    //空きエリア
    var dummy = blankField(17);
    
    //ヘッダーレコード作成
    var record = [
      "1",
      CONFIG.TYPE_CODE,
      "0",
      clientCode,
      clientName,
      mmdd,
      bankCode,
      bankName,
      branchCode,
      branchName,
      accountType(header.accountType),
      accountNumber,
      dummy,
    ].join("");
    
    //文字数チェック
    validateRecordLength(record, "ヘッダーレコード");
    return record;
  }

  /*============================================================
   * データレコード
   * 1振込 = 1レコード
   * 120バイト
   * =========================================================*/
  function buildDataRecord(row, warnings) {
    //被仕向銀行番号
    var bankCode = numericField(row.bankCode, 4, "被仕向銀行番号");
    //銀行名
    var bankName = kanaField(row.bankName, 15, "銀行名", warnings);
    //被仕向支店番号
    var branchCode = numericField(row.branchCode, 3, "被仕向支店番号");
    //支店名
    var branchName = kanaField(row.branchName, 15, "支店名", warnings);
    //手形交換所番号
    var clearingHouseCode = numericField(row.clearingHouseCode || "0000",4);
    //預金種目
    var type = accountType(row.accountType);
    //口座番号
    var accountNumber = numericField(row.accountNumber, 7, "口座番号");
    //受取人名
    var recipientName = kanaField(row.recipientName, 30, "受取人名", warnings);
    //振込金額
    var amount = numericField(row.amount, 10, "振込金額");
    if (Number(row.amount) <= 0) { //1以下は受け付けない
      throw new Error("振込金額は1円以上で入力してください。");
    }
    
    
    
    //新規コード
    var newCode = row.newCode != null ? String(row.newCode) : "0";
    newCode = textField(newCode, 1, "新規コード");
    //顧客コード1
    var customerCode1 = textField(
      row.customerCode1 != null ? row.customerCode1 : "",10,"顧客コード1"
    );
     //顧客コード2
    var customerCode2 = textField(
      row.customerCode2 != null ? row.customerCode2 : "",10,"顧客コード2"
    );
    // 振込指定区分
    var transferType =
      row.transferType != null ? String(row.transferType) : "7";
    transferType = textField(transferType, 1, "振込指定区分");
    //識別表示
    var identification =
      row.identification != null ? String(row.identification) : " ";
    identification = textField(identification, 1, "識別表示");
    
    
    
    
    //ダミー
    var dummy = blankField(7);
    
    //データレコード作成
    var record = [
      "2",
      bankCode,
      bankName,
      branchCode,
      branchName,
      clearingHouseCode,
      type,
      accountNumber,
      recipientName,
      amount,
      newCode,
      customerCode1,
      customerCode2,
      transferType,
      identification,
      dummy,
    ].join("");
    
    //文字数チェック
    validateRecordLength(record, "データレコード");
    return record;
  }

  /* ============================================================
   * トレーラーレコード
   * 1 + 6 + 12 + 101 = 120
   * ==========================================================*/
  function buildTrailerRecord(rows) {
    var count = rows.length;
    var totalAmount = rows.reduce(function (sum, row) {
      var amount = Number(row.amount);
      if (!Number.isFinite(amount)) {throw new Error("振込金額が不正です。");}
      return sum + amount;
    }, 0);
    
    //トレーラーレコード作成
    var record = [
      "8",
      String(count).padStart(6, "0"),
      String(totalAmount).padStart(12, "0"),
      blankField(101),
    ].join("");
    
    validateRecordLength(record, "トレーラーレコード");

    return record;
  }

  /*============================================================
   * エンドレコード
   * 1 + 119 = 120
   * =========================================================*/
  function buildEndRecord() {
    var record = "9" + blankField(119);
    validateRecordLength(record, "エンドレコード");
    return record;
  }

  /* ============================================================
   * 全銀フォーマット生成
   * 順番にレコードを追加していく
   * 全銀(ヘッダー + データ + トレーラー + エンド)
   * ==========================================================*/
  function generateZenginFormat(header, rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("振込データが1件以上必要です。");
    }
    var warnings = [];
    var records = [];
    /* --------------------------------------------------------
     * 1. ヘッダー追加
     * ------------------------------------------------------*/
    records.push(buildHeaderRecord(header, warnings));
    /* --------------------------------------------------------
     * 2. データ追加
     * ------------------------------------------------------*/
    rows.forEach(function (row) {
      records.push(buildDataRecord(row, warnings));
    });
    /* --------------------------------------------------------
     * 3. トレーラー追加
     * ------------------------------------------------------*/
    records.push(buildTrailerRecord(rows));
    /* --------------------------------------------------------
     * 4. エンド追加
     * ------------------------------------------------------*/
    records.push(buildEndRecord());
    /* --------------------------------------------------------
     * 5. 各レコードを120バイトチェック
     * ------------------------------------------------------*/
    records.forEach(function (record, index) {
      validateRecordBytes(record, "レコード" + (index + 1));
    });

    /* --------------------------------------------------------
     * CRLFで結合
     * ------------------------------------------------------*/
    var text = records.join(CONFIG.LINE_BREAK);

    /**
     * --------------------------------------------------------
     * ファイル全体をShift_JISへ変換
     * --------------------------------------------------------
     */
    var bytes = encodeShiftJIS(text);

    /*--------------------------------------------------------
     * ファイルサイズ
     * レコード数 × 120
     * CRLF × (レコード数 - 1)
     * ------------------------------------------------------*/
    var expectedBytes =
      records.length * CONFIG.RECORD_BYTES + (records.length - 1) * 2;

    if (bytes.length !== expectedBytes) {
      throw new Error(
        "ファイルサイズが想定値と一致しません。\n" +
          "想定:" +
          expectedBytes +
          "バイト\n" +
          "実際:" +
          bytes.length +
          "バイト"
      );
    }
    /* --------------------------------------------------------
     * 結果
     * ------------------------------------------------------*/
    return {
      text: text,
      bytes: bytes,
      records: records,
      warnings: warnings,
      recordCount: records.length,
      transferCount: rows.length,
      totalAmount: rows.reduce(function (sum, row) {
        return sum + Number(row.amount);
      }, 0),
    };
  }

  /**
   * ============================================================
   * TXTファイルとしてダウンロード
   * ============================================================
   */
  function downloadZenginFile(result, fileName) {
    /* generate()で
     * すでにShift_JIS変換済み
     * result.bytes
     * をそのまま利用 */
    var bytes = result.bytes;
    var blob = new Blob([bytes], {
      type: "text/plain",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName || CONFIG.DEFAULT_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  /* ==========================================
    現在の日付（ダウンロード用）を生成
  ========================================== */
  function createDateNow(){ 
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return [y, m, dt].join("-");
  }

  /* ============================================================
   * デバッグ　テストコード
   * ==========================================================*/
  function debug(result) {
    console.group("全銀フォーマット");
    console.log("レコード数:", result.recordCount);
    console.log("振込件数:", result.transferCount);
    console.log("合計金額:", result.totalAmount);
    console.log("ファイルサイズ:", result.bytes.length, "bytes");
    // 処理するバイトコードを配列で処理
    result.records.forEach(function (record, index) {
      var bytes = encodeShiftJIS(record);
      console.log("--------------------------------");
      console.log("レコード" + (index + 1));
      console.log("文字数:", record.length);
      console.log("バイト数:", bytes.length);
      console.log("内容:", record);
    });
    //警告数のチェック
    if (result.warnings.length > 0) {
      console.warn("警告");
      result.warnings.forEach(function (warning) {
        console.warn(warning);
      });
    }
    console.groupEnd();
  }
  
  /* ============================================================
   * 外部から使えるようにする
   * ==========================================================*/
  window.ZenginFormat = {
    generate: generateZenginFormat,
    download: downloadZenginFile,
    encodeShiftJIS: encodeShiftJIS,
    debug: debug,
  };  
  

  // ============================================================
  // メインの処理
  // ============================================================
  kintone.events.on('app.record.index.show',(event)=>{
    
    //一覧にデータがない場合はボタンを表示しない
    if(event.records.length === 0) return;
    
    // ------------------------------------------------
    // 指定した一覧画面のみ全銀フォーマットボタンを表示
    // ------------------------------------------------
    //ボタンバグ回避
    $('#' + CONFIG.BUTTON_ID).remove();
    
    if(event.viewName !== "全銀フォーマット"){
      return;
    }
    
    
    const $btn_create_zenginFormat = $('<button>',{
      id:CONFIG.BUTTON_ID,
      class:"",
      html: '<i class="fa-solid fa-download"></i> 全銀FORMAT',
    }).css({
      'padding': '10px 20px',
      'margin-left':'8px',
      'border': 'none',
      'border-radius': '4px',
      'background-color': 'orange',
      'color': '#fff',
      'cursor': 'pointer',
      'font-size': '16px',
      'height': '48px',
      'box-sizing': 'border-box',
      'transition': 'background-color 0.2s ease, transform 0.1s ease'    
    })
    .on("mouseenter", function () {
      $(this).css("background-color", "#2980b9");
    })
    // マウスアウト時
    .on("mouseleave", function () {
      $(this).css("background-color", "orange");
    })
    // 
    .on("mousedown", function () {
      $(this).css("transform", "translateY(1px)");
    })
    // 
    .on("mouseup", function () {
      $(this).css("transform", "translateY(0)");
      //css定義
    }).on('click',async ()=>{
      //kintoneAPI を実装して処理を行う・
      /* -------------------------------------------------
      ・ここからindex.showの一覧画面の検索状態を元に計算
      ・銀行DBからデータを検索することも必要
      ・Promiseでの処理で確実に実行できるようにする
      ・textファイルが完成してから出力するようにする
      ------------------------------------------------- */
      
      const records = event.records;
      //ここに配列
      let rows = [];
      
      records.forEach((record,index)=>{

        const jsonBody = {
          bankCode: record["金融機関コード"]["value"],     // 引落金融機関番号
          bankName: record["金融機関名カナ"]["value"],     // 引落金融機関名
          branchCode:record["店舗コード"]["value"],        // 引落支店番号
          branchName:record["店舗名カナ"]["value"],        // 引落支店名
          clearingHouseCode:"0000",                        // 手形交換所番号
          accountType: record["口座種別コード"]["value"],  // 預金種目
          accountNumber: record["口座番号"]["value"],      // 口座番号
          recipientName:record["口座名義カナ"]["value"],   // 受取人名
          amount:record["追加給付額"]["value"],            // 振込金額
          newCode: "0",//初回:1,変更:2,他:3(スペースOK)　　 // 新規コード
          customerCode1: "0000000000",                     // 顧客コード
          customerCode2: "0000000000",                     // 顧客コード
          transferType: "7",//固定　　　　　　　　　　　　 // 振込指定区分7 or 8だが基本は7
          identification: " "//      
        }
        rows.push(jsonBody);
        
      },(error)=>{
        //エラー処理
        console.log(`エラーです。確認してください${error}`);
      });
      
      
      //-------------------------------------------------
      // 堺市役所給付時の口座情報ヘッダーレコードに使用
      //-------------------------------------------------
      var header = {
        clientCode: "3100168211",
        clientName: "ｻｶｲｼﾂｲｶｷｭｳﾌ",
        transferDate: "2026-10-09",
        bankCode: "0005",
        bankName: "ﾐﾂﾋﾞｼﾕ-ｴﾌｼﾞｴｲ",
        branchCode: "202",//堺支店
        branchName: "ﾎﾝﾃﾝ",
        accountType: "1",
        accountNumber: "2955001"//口座番号
      }; 
      
     //Promiseの処理
      // 振込データ
      
      var rows1 = [
        {
          bankCode: "0164",
          bankName: "ﾀｼﾞﾏ",
          branchCode: "334",
          branchName: "ﾆｼﾉﾐﾔｷﾀｸﾞﾁ",
          clearingHouseCode:"0000",
          accountType: "1",
          accountNumber: "7654321",
          recipientName: "ﾔﾏﾀﾞﾀﾛｳ",
          amount: 213467,
          newCode: " ",//初回:1,変更:2,他:3(スペースOK)
          customerCode1: "",//顧客コード
          customerCode2: "",//顧客コード
          transferType: "7",
          identification: " "
        },
        {
          bankCode: "0009",
          bankName: "ﾐﾂｲｽﾐﾄﾓ",
          branchCode: "370",
          branchName: "ﾆｼﾉﾐﾔ",
          clearingHouseCode:"0000",
          accountType: "1",
          accountNumber: "1234567",
          recipientName: "ｵｵﾀﾏｻﾕｷ",
          amount: 345201,
          newCode: " ",
          customerCode1: "",
          customerCode2: "",
          transferType: "7",//振込指定区分7,8
          identification: " "
        }
      ];  
      

      // 全銀フォーマット生成
      const result = generateZenginFormat(header, rows1);
      // デバッグ
      debug(result);
      
      //ダウンロード時の日付生成
      const downloadDate = createDateNow(); 
      
      //最終的にZIPファイルとして生成します。
      try{
        //Zipファイル登録 
        const response = await registerZenginZip(result,header);
        alert("Zipファイルを登録しました。\n" + "登録先のアプリは88です。");
      }catch(error){
        console.log(error,);
        alert("ZIPファイルを登録できませんでした。",error.message);
      }
    　//出力はしない
      // TXTファイルとしてダウンロード
      //downloadZenginFile(
      //  result,
      //  downloadDate +"_zengin_" + header.transferDate + ".txt"
      //);
    });
    // =====================================================
    // ヘッダーに追加
    // =====================================================
    const headerSpace = kintone.app.getHeaderMenuSpaceElement();
    $(headerSpace).append($btn_create_zenginFormat);
    return event;
  });

  
})();
