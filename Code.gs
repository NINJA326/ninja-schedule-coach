const APP_VERSION = 'v4-line-player-priority';
const PROP_SCHEDULE_SS_ID = 'SCHEDULE_SPREADSHEET_ID';
const PROP_COACH_PASSWORD = 'COACH_PASSWORD';
const PROP_ATTACHMENT_FOLDER_ID = 'ATTACHMENT_FOLDER_ID';
const PROP_MASTER_SS_ID = 'MASTER_SPREADSHEET_ID';
const PROP_LINE_CHANNEL_ID = 'LINE_LOGIN_CHANNEL_ID';
const PROP_LIFF_ID = 'LINE_LIFF_ID';
const PLAYER_SHEET = 'players';
const ATTENDANCE_SHEET = 'attendance';
const DATA_SHEET = 'schedule_data';
const ATTACHMENT_SHEET = 'schedule_attachments';
const TOKEN_PREFIX = 'schedule-token:';
const TOKEN_TTL_SECONDS = 21600;
const UPLOAD_PREFIX = 'schedule-upload:';

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const callback = safeCallback_(p.callback);
  const action = clean_(p.action);
  let result;
  try {
    switch (action) {
      case 'health': result = ok_({version: APP_VERSION}); break;
      case 'publicConfig': result = publicConfig_(); break;
      case 'login': result = login_(p); break;
      case 'lineLogin': result = lineLogin_(p); break;
      case 'logout': result = logout_(p); break;
      case 'events': result = events_(p.month, requireSession_(p.token)); break;
      case 'event': result = event_(p.scheduleId, requireSession_(p.token)); break;
      case 'save': requireCoach_(p.token); result = saveEvent_(p); break;
      case 'delete': requireCoach_(p.token); result = deleteEvent_(p); break;
      case 'attendanceMy': result = attendanceMy_(p.scheduleId, requirePlayer_(p.token)); break;
      case 'saveAttendance': result = saveAttendance_(p, requirePlayer_(p.token)); break;
      case 'attendanceSummary': requireCoach_(p.token); result = attendanceSummary_(p.scheduleId); break;
      case 'uploadStatus': requireCoach_(p.token); result = uploadStatus_(p.uploadId); break;
      case 'attachmentContent': result = attachmentContent_(p.attachmentId, requireSession_(p.token)); break;
      case 'deleteAttachment': requireCoach_(p.token); result = deleteAttachment_(p.attachmentId); break;
      default: throw new Error('未対応の処理です。');
    }
  } catch (err) {
    result = error_(safeErrorMessage_(err));
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  let payload = {};
  try {
    payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    if (payload.action !== 'uploadAttachment') throw new Error('未対応の処理です。');
    requireCoach_(payload.token);
    const result = uploadAttachment_(payload);
    putUploadResult_(payload.uploadId, result);
  } catch (err) {
    putUploadResult_(payload.uploadId || '', error_(safeErrorMessage_(err)));
  }
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}

function publicConfig_() {
  const props=PropertiesService.getScriptProperties();
  return ok_({liffId:clean_(props.getProperty(PROP_LIFF_ID)),version:APP_VERSION});
}

function login_(p) {
  const configured = PropertiesService.getScriptProperties().getProperty(PROP_COACH_PASSWORD);
  if (!configured) throw new Error('COACH_PASSWORDが設定されていません。');
  if (!constantTimeEquals_(String(p.password || ''), configured)) throw new Error('パスワードが違います。');
  const session={role:'coach',name:'コーチ'};
  return issueSession_(session);
}

function lineLogin_(p) {
  const idToken=clean_(p.idToken);
  if(!idToken) throw new Error('LINE認証情報を取得できません。');
  const profile=verifyLineIdToken_(idToken);
  const player=findPlayerByLineUserId_(profile.sub);
  if(!player) throw new Error('選手情報とLINEアカウントが連携されていません。');
  return issueSession_({
    role:'player',lineUserId:profile.sub,playerId:player.playerId,
    playerName:player.playerName,category:player.category
  });
}

function issueSession_(session) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(TOKEN_PREFIX + token, JSON.stringify(session), TOKEN_TTL_SECONDS);
  return ok_({token:token,expiresIn:TOKEN_TTL_SECONDS,role:session.role,player:session.role==='player'?{
    playerId:session.playerId,playerName:session.playerName,category:session.category
  }:null});
}

function logout_(p) {
  if (p.token) CacheService.getScriptCache().remove(TOKEN_PREFIX + clean_(p.token));
  return ok_({loggedOut: true});
}

function requireSession_(token) {
  const t=clean_(token);
  const raw=t?CacheService.getScriptCache().get(TOKEN_PREFIX+t):'';
  if(!raw) throw new Error('ログインの有効期限が切れました。再ログインしてください。');
  CacheService.getScriptCache().put(TOKEN_PREFIX+t,raw,TOKEN_TTL_SECONDS);
  try{return JSON.parse(raw)}catch(e){return {role:'coach',name:'コーチ'}}
}
function requireCoach_(token){
  const s=requireSession_(token);
  if(s.role!=='coach') throw new Error('コーチ権限が必要です。');
  return s;
}
function requirePlayer_(token){
  const s=requireSession_(token);
  if(s.role!=='player'||!s.playerId) throw new Error('選手のLINE認証が必要です。');
  return s;
}

function verifyLineIdToken_(idToken) {
  const channelId=clean_(PropertiesService.getScriptProperties().getProperty(PROP_LINE_CHANNEL_ID));
  if(!channelId) throw new Error('LINE_LOGIN_CHANNEL_IDが設定されていません。');
  const response=UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify',{
    method:'post',contentType:'application/x-www-form-urlencoded',
    payload:{id_token:idToken,client_id:channelId},muteHttpExceptions:true
  });
  const body=response.getContentText();
  let data={};try{data=JSON.parse(body)}catch(e){}
  if(response.getResponseCode()!==200||!data.sub) throw new Error('LINE認証を確認できませんでした。');
  return data;
}

function openMasterSpreadsheet_() {
  const id=clean_(PropertiesService.getScriptProperties().getProperty(PROP_MASTER_SS_ID));
  if(!id) throw new Error('MASTER_SPREADSHEET_IDが設定されていません。');
  return SpreadsheetApp.openById(id);
}

function findPlayerByLineUserId_(lineUserId) {
  const ss=openMasterSpreadsheet_();
  const sheet=ss.getSheetByName(PLAYER_SHEET);
  if(!sheet||sheet.getLastRow()<2) return null;
  const values=sheet.getDataRange().getDisplayValues();
  const headers=values[0].map(normalizeHeader_);
  const lineCol=findHeaderIndex_(headers,['lineuserid','line_user_id','lineユーザーid','lineid','line連携id']);
  const idCol=findHeaderIndex_(headers,['playerid','player_id','選手id','id']);
  const nameCol=findHeaderIndex_(headers,['name','playername','player_name','氏名','選手名']);
  const catCol=findHeaderIndex_(headers,['category','カテゴリー','所属カテゴリー']);
  if(lineCol<0||idCol<0||nameCol<0) throw new Error('playersシートの見出しを確認してください。');
  for(let i=1;i<values.length;i++){
    if(clean_(values[i][lineCol])===lineUserId){
      return {playerId:clean_(values[i][idCol]),playerName:clean_(values[i][nameCol]),category:catCol>=0?clean_(values[i][catCol]):''};
    }
  }
  return null;
}

function normalizeHeader_(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\s\-]/g,'')}
function findHeaderIndex_(headers,candidates){
  const normalized=candidates.map(normalizeHeader_);
  for(let i=0;i<headers.length;i++) if(normalized.includes(headers[i])) return i;
  return -1;
}

function openScheduleSpreadsheet_() {
  const id = clean_(PropertiesService.getScriptProperties().getProperty(PROP_SCHEDULE_SS_ID));
  if (!id) throw new Error('SCHEDULE_SPREADSHEET_IDが設定されていません。');
  return SpreadsheetApp.openById(id);
}

function ensureDataSheet_(ss) {
  const headers = ['scheduleId','date','categoriesJson','type','title','location','startTime','endTime','note','color','source','mirrorRefsJson','createdAt','updatedAt','deleted','allDay','attendanceEnabled','deadlineDays','deadlineTime','deadlineAt'];
  let sheet = ss.getSheetByName(DATA_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DATA_SHEET);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const existing = sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),20)).getDisplayValues()[0];
    if (sheet.getLastColumn()<20) sheet.getRange(1,1,1,headers.length).setValues([headers]);
    if (existing[2] === 'category') {
      sheet.getRange(1,3).setValue('categoriesJson');
      sheet.getRange(1,12).setValue('mirrorRefsJson');
      const last = sheet.getLastRow();
      if (last >= 2) {
        const vals = sheet.getRange(2,3,last-1,1).getValues();
        sheet.getRange(2,3,last-1,1).setValues(vals.map(r => [JSON.stringify(parseCategories_(r[0]))]));
        const refs = sheet.getRange(2,12,last-1,1).getValues();
        sheet.getRange(2,12,last-1,1).setValues(refs.map(r => [normalizeMirrorRefsJson_(r[0])]));
      }
    }
  }
  return sheet;
}

function ensureAttachmentSheet_(ss) {
  const headers = ['attachmentId','scheduleId','fileId','fileName','mimeType','size','openUrl','viewUrl','createdAt','deleted'];
  let sheet = ss.getSheetByName(ATTACHMENT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ATTACHMENT_SHEET);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function events_(requestedMonth, session) {
  const ss = openScheduleSpreadsheet_();
  const month = normalizeMonthKey_(requestedMonth);
  if (!month) throw new Error('対象月が正しくありません。');
  let managed = readManagedEvents_(ss, month);
  if(session.role==='player') managed=managed.filter(e=>eventAllowedForPlayer_(e,session));
  const sheet = findScheduleSheet_(ss, month);
  return ok_({
    month: month,
    events: managed,
    sourceUrl: sheet ? 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/edit#gid=' + sheet.getSheetId() : 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/edit'
  });
}

function event_(scheduleId, session) {
  const ss = openScheduleSpreadsheet_();
  const event = findManagedEvent_(ss, clean_(scheduleId));
  if (!event) throw new Error('予定が見つかりません。');
  if(session.role==='player'&&!eventAllowedForPlayer_(event,session)) throw new Error('この予定を閲覧する権限がありません。');
  event.attachments = readAttachments_(ss, event.scheduleId);
  if(session.role==='player') event.myAttendance=readAttendanceForPlayer_(event.scheduleId,session.playerId);
  return ok_({event: event});
}

function saveEvent_(p) {
  const date = normalizeDate_(p.date);
  const categories = parseJsonArray_(p.categories);
  const type = clean_(p.type) || '練習';
  const title = clean_(p.title);
  const location = clean_(p.location);
  const allDay = toBoolean_(p.allDay);
  const startTime = allDay ? '' : clean_(p.startTime);
  const endTime = allDay ? '' : clean_(p.endTime);
  const note = clean_(p.note);
  const attendanceEnabled=toBoolean_(p.attendanceEnabled);
  const deadlineDays=Math.max(0,Math.min(60,Number(p.deadlineDays)||0));
  const deadlineTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(clean_(p.deadlineTime))?clean_(p.deadlineTime):'21:00';
  const deadlineAt=attendanceEnabled?calculateDeadline_(date,deadlineDays,deadlineTime):'';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日付を正しく入力してください。');
  if (!categories.length) throw new Error('カテゴリーを1つ以上選択してください。');
  if (!title && !location && !type) throw new Error('予定内容を入力してください。');
  if (!allDay && startTime && endTime && startTime >= endTime) throw new Error('終了時間は開始時間より後にしてください。');

  const ss = openScheduleSpreadsheet_();
  const sheet = ensureDataSheet_(ss);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const suppliedId = clean_(p.scheduleId);
    const id = suppliedId.indexOf('app-') === 0 ? suppliedId : 'app-' + Utilities.getUuid();
    let row = 0, oldRefs = [];
    if (sheet.getLastRow() >= 2) {
      const rows = sheet.getRange(2,1,sheet.getLastRow()-1,20).getValues();
      for (let i=0;i<rows.length;i++) {
        if (clean_(rows[i][0]) === id) {
          row = i + 2;
          oldRefs = parseMirrorRefs_(rows[i][11]);
          break;
        }
      }
    }
    clearMirrorRefs_(ss, oldRefs);

    const color = colorForType_(type);
    const event = {scheduleId:id,date:date,categories:categories,type:type,title:title,location:location,startTime:startTime,endTime:endTime,note:note,color:color,allDay:allDay,attendanceEnabled:attendanceEnabled,deadlineDays:deadlineDays,deadlineTime:deadlineTime,deadlineAt:deadlineAt};
    const mirrorRefs = mirrorToMonthlySheet_(ss, event);
    const now = new Date();
    const createdAt = row ? (sheet.getRange(row,13).getValue() || now) : now;
    const targetRow = row || sheet.getLastRow() + 1;
    sheet.getRange(targetRow,1,1,20).setValues([[
      id,date,JSON.stringify(categories),type,title,location,startTime,endTime,note,color,'app',
      JSON.stringify(mirrorRefs),createdAt,now,false,allDay,attendanceEnabled,deadlineDays,deadlineTime,deadlineAt
    ]]);
    SpreadsheetApp.flush();

    const verify = sheet.getRange(targetRow,1,1,20).getValues()[0];
    if (clean_(verify[0]) !== id || normalizeDate_(verify[1]) !== date) throw new Error('保存確認に失敗しました。');
    event.source = 'app';
    event.sourceRef = JSON.stringify(mirrorRefs);
    event.attachments = readAttachments_(ss, id);
    return ok_({event:event});
  } finally {
    lock.releaseLock();
  }
}

function deleteEvent_(p) {
  const id = clean_(p.scheduleId);
  if (!id || id.indexOf('app-') !== 0) throw new Error('削除対象が正しくありません。');
  const ss = openScheduleSpreadsheet_();
  const sheet = ensureDataSheet_(ss);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sheet.getLastRow() < 2) throw new Error('削除対象が見つかりません。');
    const rows = sheet.getRange(2,1,sheet.getLastRow()-1,20).getValues();
    for (let i=0;i<rows.length;i++) {
      if (clean_(rows[i][0]) === id) {
        clearMirrorRefs_(ss, parseMirrorRefs_(rows[i][11]));
        sheet.getRange(i+2,15).setValue(true);
        sheet.getRange(i+2,14).setValue(new Date());
        trashAttachmentsForSchedule_(ss,id);
        SpreadsheetApp.flush();
        return ok_({deleted:true});
      }
    }
    throw new Error('削除対象が見つかりません。');
  } finally {
    lock.releaseLock();
  }
}

function readManagedEvents_(ss, month) {
  const sheet = ensureDataSheet_(ss);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,20).getValues()
    .filter(r => normalizeDate_(r[1]).slice(0,7) === month && !toBoolean_(r[14]))
    .map(r => ({
      scheduleId:clean_(r[0]),date:normalizeDate_(r[1]),categories:parseCategories_(r[2]),
      type:clean_(r[3]),title:clean_(r[4]),location:clean_(r[5]),startTime:clean_(r[6]),endTime:clean_(r[7]),
      note:clean_(r[8]),color:colorForType_(clean_(r[3])),source:'app',sourceRef:clean_(r[11]),
      updatedAt:formatDateTime_(r[13]),allDay:toBoolean_(r[15]),attendanceEnabled:toBoolean_(r[16]),deadlineDays:Number(r[17])||0,deadlineTime:clean_(r[18])||'21:00',deadlineAt:formatDateTime_(r[19]),attachments:readAttachments_(ss,clean_(r[0]))
    }))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));
}

function findManagedEvent_(ss,id) {
  const sheet = ensureDataSheet_(ss);
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,20).getValues();
  for (let i=0;i<rows.length;i++) {
    const r=rows[i];
    if (clean_(r[0])===id && !toBoolean_(r[14])) {
      return {
        scheduleId:clean_(r[0]),date:normalizeDate_(r[1]),categories:parseCategories_(r[2]),
        type:clean_(r[3]),title:clean_(r[4]),location:clean_(r[5]),startTime:clean_(r[6]),endTime:clean_(r[7]),
        note:clean_(r[8]),color:colorForType_(clean_(r[3])),source:'app',sourceRef:clean_(r[11]),
        updatedAt:formatDateTime_(r[13]),allDay:toBoolean_(r[15]),attendanceEnabled:toBoolean_(r[16]),deadlineDays:Number(r[17])||0,deadlineTime:clean_(r[18])||'21:00',deadlineAt:formatDateTime_(r[19])
      };
    }
  }
  return null;
}

function mirrorToMonthlySheet_(ss,event) {
  const month = event.date.slice(0,7);
  const day = Number(event.date.slice(8,10));
  const sheet = findScheduleSheet_(ss,month);
  if (!sheet) throw new Error(month + 'の月別シートがありません。');
  const values = sheet.getDataRange().getDisplayValues();
  const header = detectHeaders_(sheet,values);
  if (!header) throw new Error('予定表の見出しを確認できません。');
  let targetRow=0;
  for (let r=header.headerRow+1;r<=values.length;r++) {
    const v=Number(String(values[r-1][header.dayCol-1]||'').replace(/[^0-9]/g,''));
    if (v===day){targetRow=r;break}
  }
  if (!targetRow) throw new Error(day + '日の行が見つかりません。');

  const text=[event.title,event.location].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' ');
  const time=event.allDay?'終日':[event.startTime,event.endTime].filter(Boolean).join('〜');
  const refs=[];
  event.categories.forEach(category=>{
    const group=matchCategory_(header.groups,category);
    if (!group) throw new Error('カテゴリー「'+category+'」の列が見つかりません。');
    if (group.endCol>group.startCol) {
      sheet.getRange(targetRow,group.startCol).setValue(text||event.type);
      sheet.getRange(targetRow,group.startCol+1).setValue(time);
      if (group.endCol>group.startCol+1) sheet.getRange(targetRow,group.startCol+2,1,group.endCol-group.startCol-1).clearContent();
    } else {
      sheet.getRange(targetRow,group.startCol).setValue([text||event.type,time].filter(Boolean).join(' '));
    }
    sheet.getRange(targetRow,group.startCol,1,group.endCol-group.startCol+1).setBackground(event.color);
    refs.push({sheetName:sheet.getName(),row:targetRow,startCol:group.startCol,endCol:group.endCol});
  });
  return refs;
}

function clearMirrorRefs_(ss,refs) {
  (refs||[]).forEach(x=>{
    try{
      const sheet=ss.getSheetByName(x.sheetName);
      if(sheet&&x.row&&x.startCol&&x.endCol){
        sheet.getRange(Number(x.row),Number(x.startCol),1,Number(x.endCol)-Number(x.startCol)+1).clearContent().setBackground('#ffffff');
      }
    }catch(e){}
  });
}

function uploadAttachment_(p) {
  const uploadId=clean_(p.uploadId),scheduleId=clean_(p.scheduleId);
  if (!uploadId) throw new Error('アップロードIDがありません。');
  if (!scheduleId || scheduleId.indexOf('app-')!==0) throw new Error('先に予定を保存してください。');
  const fileName=sanitizeFileName_(p.fileName);
  const mimeType=clean_(p.mimeType);
  const base64=clean_(p.base64);
  const allowed=[
    'image/jpeg','image/png','application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (!allowed.includes(mimeType)) throw new Error('対応していないファイル形式です。');
  if (!base64) throw new Error('ファイル内容がありません。');
  const bytes=Utilities.base64Decode(base64);
  if (bytes.length > 10*1024*1024) throw new Error('1ファイル10MB以下にしてください。');

  const ss=openScheduleSpreadsheet_();
  if (!findManagedEvent_(ss,scheduleId)) throw new Error('予定が見つかりません。');
  const existing=readAttachments_(ss,scheduleId);
  if (existing.length>=10) throw new Error('1予定につき添付は10件までです。');

  const folder=getAttachmentFolder_();
  const file=folder.createFile(Utilities.newBlob(bytes,mimeType,fileName));

  const attachmentId='att-'+Utilities.getUuid();
  const sheet=ensureAttachmentSheet_(ss);
  sheet.appendRow([attachmentId,scheduleId,file.getId(),fileName,mimeType,bytes.length,'','',new Date(),false]);
  SpreadsheetApp.flush();
  return ok_({attachmentId:attachmentId,fileName:fileName});
}

function readAttachments_(ss,scheduleId) {
  const sheet=ensureAttachmentSheet_(ss);
  if (sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues()
    .filter(r=>clean_(r[1])===scheduleId&&!toBoolean_(r[9]))
    .map(r=>({
      attachmentId:clean_(r[0]),fileName:clean_(r[3]),mimeType:clean_(r[4]),size:Number(r[5])||0,
      createdAt:formatDateTime_(r[8])
    }));
}


function attachmentContent_(attachmentId, session) {
  const id=clean_(attachmentId);
  if (!id) throw new Error('添付IDがありません。');
  const ss=openScheduleSpreadsheet_();
  const sheet=ensureAttachmentSheet_(ss);
  if (sheet.getLastRow()<2) throw new Error('添付が見つかりません。');
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues();
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(clean_(r[0])===id&&!toBoolean_(r[9])){
      if(session.role==='player'){
        const event=findManagedEvent_(ss,clean_(r[1]));
        if(!event||!eventAllowedForPlayer_(event,session)) throw new Error('この添付を閲覧する権限がありません。');
      }
      const file=DriveApp.getFileById(clean_(r[2]));
      const blob=file.getBlob();
      const bytes=blob.getBytes();
      if(bytes.length>10*1024*1024) throw new Error('このファイルは大きすぎるため表示できません。');
      return ok_({
        fileName:clean_(r[3])||file.getName(),
        mimeType:clean_(r[4])||blob.getContentType(),
        base64:Utilities.base64Encode(bytes)
      });
    }
  }
  throw new Error('添付が見つかりません。');
}

function deleteAttachment_(attachmentId) {
  const id=clean_(attachmentId);
  if (!id) throw new Error('添付IDがありません。');
  const ss=openScheduleSpreadsheet_();
  const sheet=ensureAttachmentSheet_(ss);
  if (sheet.getLastRow()<2) throw new Error('添付が見つかりません。');
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues();
  for(let i=0;i<rows.length;i++){
    if(clean_(rows[i][0])===id&&!toBoolean_(rows[i][9])){
      try{DriveApp.getFileById(clean_(rows[i][2])).setTrashed(true)}catch(e){}
      sheet.getRange(i+2,10).setValue(true);
      return ok_({deleted:true});
    }
  }
  throw new Error('添付が見つかりません。');
}

function trashAttachmentsForSchedule_(ss,scheduleId) {
  const sheet=ensureAttachmentSheet_(ss);
  if (sheet.getLastRow()<2) return;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues();
  rows.forEach((r,i)=>{
    if(clean_(r[1])===scheduleId&&!toBoolean_(r[9])){
      try{DriveApp.getFileById(clean_(r[2])).setTrashed(true)}catch(e){}
      sheet.getRange(i+2,10).setValue(true);
    }
  });
}

function getAttachmentFolder_() {
  const props=PropertiesService.getScriptProperties();
  let id=clean_(props.getProperty(PROP_ATTACHMENT_FOLDER_ID));
  if (id) {
    try{return DriveApp.getFolderById(id)}catch(e){}
  }
  const folder=DriveApp.createFolder('NINJA AIRS 練習予定表 添付ファイル');
  props.setProperty(PROP_ATTACHMENT_FOLDER_ID,folder.getId());
  return folder;
}

function putUploadResult_(uploadId,result) {
  if (!uploadId) return;
  CacheService.getScriptCache().put(UPLOAD_PREFIX+uploadId,JSON.stringify(result),600);
}
function uploadStatus_(uploadId) {
  const id=clean_(uploadId);
  if (!id) throw new Error('アップロードIDがありません。');
  const raw=CacheService.getScriptCache().get(UPLOAD_PREFIX+id);
  if (!raw) return {status:'pending'};
  CacheService.getScriptCache().remove(UPLOAD_PREFIX+id);
  return JSON.parse(raw);
}


function calculateDeadline_(date,days,time){
  const parts=date.split('-').map(Number);
  const t=time.split(':').map(Number);
  const d=new Date(parts[0],parts[1]-1,parts[2],t[0],t[1],0);
  d.setDate(d.getDate()-days);
  return d;
}
function eventAllowedForPlayer_(event,session){
  const cat=normalizeCategory_(session.category);
  return !cat||event.categories.some(c=>normalizeCategory_(c)===cat);
}
function ensureAttendanceSheet_(ss){
  const headers=['attendanceId','scheduleId','playerId','playerName','category','status','arrivalTime','reason','answeredAt','updatedAt','lineUserId','deleted'];
  let sheet=ss.getSheetByName(ATTENDANCE_SHEET);
  if(!sheet){
    sheet=ss.insertSheet(ATTENDANCE_SHEET);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);
  }
  return sheet;
}
function readAttendanceForPlayer_(scheduleId,playerId){
  const sheet=ensureAttendanceSheet_(openMasterSpreadsheet_());
  if(sheet.getLastRow()<2)return null;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues();
  for(let i=rows.length-1;i>=0;i--){
    const r=rows[i];
    if(clean_(r[1])===scheduleId&&clean_(r[2])===playerId&&!toBoolean_(r[11])){
      return {attendanceId:clean_(r[0]),status:clean_(r[5]),arrivalTime:clean_(r[6]),reason:clean_(r[7]),answeredAt:formatDateTime_(r[8]),updatedAt:formatDateTime_(r[9])};
    }
  }
  return null;
}
function attendanceMy_(scheduleId,session){
  const event=findManagedEvent_(openScheduleSpreadsheet_(),clean_(scheduleId));
  if(!event||!eventAllowedForPlayer_(event,session)) throw new Error('予定が見つかりません。');
  return ok_({event:event,attendance:readAttendanceForPlayer_(event.scheduleId,session.playerId),deadlineClosed:isDeadlineClosed_(event)});
}
function isDeadlineClosed_(event){
  if(!event.attendanceEnabled)return true;
  if(!event.deadlineAt)return false;
  const d=new Date(String(event.deadlineAt).replace(' ','T'));
  return !isNaN(d)&&new Date()>d;
}
function saveAttendance_(p,session){
  const scheduleId=clean_(p.scheduleId);
  const status=clean_(p.status);
  const arrivalTime=clean_(p.arrivalTime);
  const reason=clean_(p.reason);
  if(!['出席','遅刻','欠席'].includes(status)) throw new Error('出席・遅刻・欠席のいずれかを選択してください。');
  if(status==='遅刻'){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime)) throw new Error('到着予定時刻を入力してください。');
    if(!reason) throw new Error('遅刻理由を入力してください。');
  }
  if(status==='欠席'&&!reason) throw new Error('欠席理由を入力してください。');
  const event=findManagedEvent_(openScheduleSpreadsheet_(),scheduleId);
  if(!event||!eventAllowedForPlayer_(event,session)) throw new Error('予定が見つかりません。');
  if(!event.attendanceEnabled) throw new Error('この予定は出欠回答を受け付けていません。');
  if(isDeadlineClosed_(event)) throw new Error('回答期限が終了しています。コーチへ直接連絡してください。');
  const ss=openMasterSpreadsheet_(),sheet=ensureAttendanceSheet_(ss),lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const rows=sheet.getLastRow()>=2?sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues():[];
    let row=0,id='';
    for(let i=0;i<rows.length;i++){
      if(clean_(rows[i][1])===scheduleId&&clean_(rows[i][2])===session.playerId&&!toBoolean_(rows[i][11])){row=i+2;id=clean_(rows[i][0]);break}
    }
    const now=new Date();if(!id)id='ans-'+Utilities.getUuid();
    const answeredAt=row?(sheet.getRange(row,9).getValue()||now):now;
    const target=row||sheet.getLastRow()+1;
    sheet.getRange(target,1,1,12).setValues([[id,scheduleId,session.playerId,session.playerName,session.category,status,status==='遅刻'?arrivalTime:'',status==='出席'?'':reason,answeredAt,now,session.lineUserId,false]]);
    SpreadsheetApp.flush();
    return ok_({attendance:readAttendanceForPlayer_(scheduleId,session.playerId)});
  }finally{lock.releaseLock()}
}
function attendanceSummary_(scheduleId){
  const event=findManagedEvent_(openScheduleSpreadsheet_(),clean_(scheduleId));
  if(!event)throw new Error('予定が見つかりません。');
  const master=openMasterSpreadsheet_(),playersSheet=master.getSheetByName(PLAYER_SHEET);
  const players=[];
  if(playersSheet&&playersSheet.getLastRow()>=2){
    const values=playersSheet.getDataRange().getDisplayValues(),headers=values[0].map(normalizeHeader_);
    const idCol=findHeaderIndex_(headers,['playerid','player_id','選手id','id']);
    const nameCol=findHeaderIndex_(headers,['name','playername','player_name','氏名','選手名']);
    const catCol=findHeaderIndex_(headers,['category','カテゴリー','所属カテゴリー']);
    if(idCol>=0&&nameCol>=0)for(let i=1;i<values.length;i++){
      const category=catCol>=0?clean_(values[i][catCol]):'';
      if(event.categories.some(c=>normalizeCategory_(c)===normalizeCategory_(category)))players.push({playerId:clean_(values[i][idCol]),playerName:clean_(values[i][nameCol]),category:category});
    }
  }
  const sheet=ensureAttendanceSheet_(master),map={};
  if(sheet.getLastRow()>=2)sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues().forEach(r=>{
    if(clean_(r[1])===event.scheduleId&&!toBoolean_(r[11]))map[clean_(r[2])]={status:clean_(r[5]),arrivalTime:clean_(r[6]),reason:clean_(r[7]),updatedAt:formatDateTime_(r[9])};
  });
  const rows=players.map(p=>Object.assign({},p,map[p.playerId]||{status:'未回答',arrivalTime:'',reason:'',updatedAt:''}));
  const counts={出席:0,遅刻:0,欠席:0,未回答:0};rows.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
  return ok_({counts:counts,total:rows.length,rows:rows,deadlineClosed:isDeadlineClosed_(event)});
}

function detectHeaders_(sheet,values) {
  let headerRow=0,dayCol=0,weekdayCol=0;
  for(let r=0;r<Math.min(values.length,15);r++){
    for(let c=0;c<values[r].length;c++){
      const v=clean_(values[r][c]);
      if(v==='日'||v==='日付'){headerRow=r+1;dayCol=c+1}
      if(v==='曜日')weekdayCol=c+1;
    }
    if(headerRow&&weekdayCol)break;
  }
  if(!headerRow)return null;
  if(!weekdayCol)weekdayCol=dayCol+1;
  const row=values[headerRow-1],merges=sheet.getDataRange().getMergedRanges(),groups=[];
  for(let c=weekdayCol+1;c<=row.length;c++){
    const text=clean_(row[c-1]);if(!text)continue;
    let startCol=c,endCol=c;
    const mr=merges.find(m=>m.getRow()===headerRow&&c>=m.getColumn()&&c<m.getColumn()+m.getNumColumns());
    if(mr){startCol=mr.getColumn();endCol=mr.getColumn()+mr.getNumColumns()-1}
    if(!groups.some(g=>g.startCol===startCol))groups.push({category:text,startCol:startCol,endCol:endCol});
  }
  return {headerRow:headerRow,dayCol:dayCol,weekdayCol:weekdayCol,groups:groups};
}

function findScheduleSheet_(ss,requestedMonth) {
  const target=normalizeMonthKey_(requestedMonth);
  return ss.getSheets().find(s=>monthKeyFromName_(s.getName())===target)||null;
}
function monthKeyFromName_(name) {
  const s=String(name||'').normalize('NFKC');
  let m=s.match(/(20\d{2})\D{0,3}(1[0-2]|0?[1-9])/);
  if(m)return m[1]+'-'+String(Number(m[2])).padStart(2,'0');
  m=s.match(/^(1[0-2]|0?[1-9])月$/);
  if(m)return new Date().getFullYear()+'-'+String(Number(m[1])).padStart(2,'0');
  return '';
}
function normalizeMonthKey_(value) {
  const s=String(value||'').normalize('NFKC'),m=s.match(/(20\d{2})\D{0,3}(1[0-2]|0?[1-9])/);
  return m?m[1]+'-'+String(Number(m[2])).padStart(2,'0'):'';
}
function matchCategory_(groups,category) {
  const n=normalizeCategory_(category);
  return groups.find(g=>normalizeCategory_(g.category)===n)||
    groups.find(g=>normalizeCategory_(g.category).indexOf(n)>=0||n.indexOf(normalizeCategory_(g.category))>=0)||null;
}
function parseJsonArray_(v){try{const a=JSON.parse(String(v||'[]'));return Array.isArray(a)?a.map(clean_).filter(Boolean):[]}catch(e){return parseCategories_(v)}}
function parseCategories_(v){
  if(Array.isArray(v))return v.map(clean_).filter(Boolean);
  const s=clean_(v);if(!s)return [];
  try{const a=JSON.parse(s);if(Array.isArray(a))return a.map(clean_).filter(Boolean)}catch(e){}
  return s.split(/[\/,、|]/).map(clean_).filter(Boolean);
}
function parseMirrorRefs_(v){try{const a=JSON.parse(clean_(v)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function normalizeMirrorRefsJson_(v){const a=parseMirrorRefs_(v);if(a.length)return JSON.stringify(a);try{const x=JSON.parse(clean_(v));return JSON.stringify([x])}catch(e){return '[]'}}
function normalizeCategory_(v){return String(v||'').normalize('NFKC').replace(/\s+/g,'').replace(/[（）()]/g,'').trim()}
function normalizeDate_(v){if(v instanceof Date&&!isNaN(v))return Utilities.formatDate(v,Session.getScriptTimeZone()||'Asia/Tokyo','yyyy-MM-dd');const s=String(v||'').trim(),m=s.match(/(20\d{2})\D(\d{1,2})\D(\d{1,2})/);return m?m[1]+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0'):s}
function colorForType_(type){
  const map={'練習':'#2563eb','試合':'#dc2626','遠征':'#16a34a','イベント':'#eab308','ミーティング':'#7c3aed','特別練習':'#ea580c','シューティング':'#0891b2','女子':'#db2777','OFF':'#6b7280','その他':'#92400e'};
  return map[clean_(type)]||'#2563eb';
}
function sanitizeFileName_(v){return clean_(v).replace(/[\\/:*?"<>|]/g,'_').slice(0,180)||'attachment'}
function formatDateTime_(v){return v instanceof Date&&!isNaN(v)?Utilities.formatDate(v,Session.getScriptTimeZone()||'Asia/Tokyo','yyyy-MM-dd HH:mm:ss'):clean_(v)}
function toBoolean_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'}
function clean_(v){return String(v==null?'':v).trim()}
function safeCallback_(v){const s=clean_(v);return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(s)?s:'callback'}
function constantTimeEquals_(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function safeErrorMessage_(e){return e&&e.message?String(e.message):'処理に失敗しました。'}
function ok_(data){return Object.assign({status:'ok'},data||{})}
function error_(message){return {status:'error',message:message}}


function setupAttendanceV3() {
  const schedule=openScheduleSpreadsheet_();
  ensureDataSheet_(schedule);
  ensureAttachmentSheet_(schedule);
  const master=openMasterSpreadsheet_();
  ensureAttendanceSheet_(master);
  Logger.log('予定表: '+schedule.getName());
  Logger.log('管理表: '+master.getName());
  Logger.log('attendanceシート準備完了');
}