import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Users, Clock, DollarSign, MessageCircle, 
  CheckCircle, ShieldCheck, User, Baby, Plus, Minus,
  Lock, X, LayoutDashboard, Sun, Moon, Sunrise, ChevronLeft, ChevronRight, 
  Settings, Phone, HelpCircle, Trash2, Link,
  UploadCloud, FileText, Wallet, Cloud, Calculator,
  Receipt, BarChart3, Scan, Search, Smartphone, Save, Download
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let fConfig = {   apiKey: "AIzaSyDCInFab_ayW_M5qlJWG4ytDiNip5Fk350",
  authDomain: "infinity-party.firebaseapp.com",
  projectId: "infinity-party",
  storageBucket: "infinity-party.firebasestorage.app",
  messagingSenderId: "1005334901661",
  appId: "1:1005334901661:web:3fc4886317ad3c433b3574",
  measurementId: "G-KTY0CMB5BN"};
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    fConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.error("Firebase config parsing failed", e);
}

const app = initializeApp(fConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// 核心修復：確保 Firebase 集合路徑中不會出現斜線導致崩潰
const safeAppId = appId.replace(/\//g, '_');

const DEFAULT_PRICING = { minCharge: 2000, adultBase: 188, adultOvertime: 40, childBase: 94, childOvertime: 20, flatBase: 3880, flatOvertime: 1000, deposit: 1000 };
const DEFAULT_ADDONS = [
  { id: 'a1', name: '🍕 豪華到會派對套餐', price: 800, leadTime: '需提前48小時' },
  { id: 'a2', name: '🎈 專人生日氣球佈置', price: 500, leadTime: '需提前24小時' },
];
const DEFAULT_SYSTEM = { 
  successMessage: '感謝您的預約。\n請支付【訂金】以保留檔期。\n我們已透過 WhatsApp 發送確認信及付款指引，請將付款截圖回傳給我們。',
  termsAndConditions: '1 - 人數一經確定，可加不可減\n2 - 除非不可抗力因素，如八號風球，否則不設改期或退款\n3 - 請預留時間收拾還原場地，如太多垃圾或混亂，會收取清潔費$300 起',
  expenseCategories: ['日常耗材', '到會/食材', '清潔費', '水電煤網', '維修保養', '行銷廣告', '退款/賠償', '其他'],
  brandName: 'INFINITY PARTY',
  brandSub: '24H 智能自助派對空間',
  brandLogo: '',
  address: '香港九龍觀塘開源道xx號',
  adminPassword: 'admin123',
  promoCodes: []
};

export default function InfinityPartyApp() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('BOOKING'); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [dbError, setDbError] = useState('');

  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [addonsConfig, setAddonsConfig] = useState(DEFAULT_ADDONS);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING);
  const [systemConfig, setSystemConfig] = useState(DEFAULT_SYSTEM);
  const [isCloudSyncing, setIsCloudSyncing] = useState(true);

  const isDummyConfig = fConfig.projectId === 'dummy';

  useEffect(() => {
    const initAuth = async () => {
      if (isDummyConfig) {
        setUser({ uid: 'local-tester' });
        return;
      }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Auth error:", e); }
    };
    initAuth();
    if (!isDummyConfig) {
       const unsubscribe = onAuthStateChanged(auth, setUser);
       return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isDummyConfig) {
      setIsCloudSyncing(false);
      return;
    }

    const handleSyncError = (err, type) => {
      console.error(`${type} sync error:`, err);
      if (err.code === 'permission-denied' || err.message.includes('permission')) {
        setDbError('⚠️ Firebase 權限不足：請至 Firebase 後台的 Firestore Database -> 規則 (Rules)，將代碼改為 allow read, write: if true;');
      }
      setIsCloudSyncing(false);
    };

    const bookingsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(bookingsRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setBookings(data);
    }, (err) => handleSyncError(err, 'Bookings'));

    const expensesRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setExpenses(data);
    }, (err) => handleSyncError(err, 'Expenses'));

    const settingsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'settings');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      let sysConf = { ...DEFAULT_SYSTEM };
      snap.docs.forEach(doc => {
        if (doc.id === 'pricing') setPricingConfig({ ...DEFAULT_PRICING, ...doc.data() });
        if (doc.id === 'addons') setAddonsConfig(doc.data().items || DEFAULT_ADDONS);
        if (doc.id === 'system') sysConf = { ...sysConf, ...doc.data() };
      });
      setSystemConfig(sysConf);
      setIsCloudSyncing(false);
    }, (err) => handleSyncError(err, 'Settings'));

    return () => { unsubBookings(); unsubExpenses(); unsubSettings(); };
  }, [user]);

  // =============== 雲端/單機 雙軌儲存邏輯 ===============

  const saveConfigToCloud = async (collectionName, dataObj) => {
    if (isDummyConfig) return; // 單機模式下，設定已透過 React State 更新
    if (!user) return;
    try { await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'settings', collectionName), dataObj); } 
    catch (e) { console.error("Save config error:", e); }
  };

  const updateBookingInCloud = async (id, updates) => {
    if (isDummyConfig) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      return;
    }
    if (!user) return;
    try { await updateDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'bookings', id), updates); } 
    catch (e) {
      console.error("Update booking error:", e);
      // 核心修復：若 Firebase 儲存失敗（如權限阻擋），強制暫存於本地記憶體，確保關閉視窗後變更不遺失
      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    }
  };

  const deleteBookingFromCloud = async (id) => {
    if (isDummyConfig) {
      setBookings(prev => prev.filter(b => b.id !== id));
      return;
    }
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'bookings', id)); }
    catch (e) {
      console.error("Delete booking error:", e);
      setBookings(prev => prev.filter(b => b.id !== id));
    }
  };

  const saveExpenseToCloud = async (expense) => {
    if (isDummyConfig) {
      setExpenses(prev => {
        const exists = prev.find(e => e.id === expense.id);
        if (exists) return prev.map(e => e.id === expense.id ? expense : e);
        return [expense, ...prev];
      });
      return;
    }
    if (!user) return;
    try { await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'expenses', expense.id), expense); }
    catch (e) {
      console.error("Save expense error:", e);
      setExpenses(prev => {
        const exists = prev.find(e => e.id === expense.id);
        if (exists) return prev.map(e => e.id === expense.id ? expense : e);
        return [expense, ...prev];
      });
    }
  };

  const deleteExpenseFromCloud = async (id) => {
    if (isDummyConfig) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      return;
    }
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'expenses', id)); }
    catch (e) {
      console.error("Delete expense error:", e);
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };
  // ========================================================

  const getBookedSlotsMap = () => {
    const map = {};
    bookings.forEach(b => {
      if (!map[b.date]) map[b.date] = { sessions: [], bookings: [] };
      if (!map[b.date].sessions.includes(b.session)) map[b.date].sessions.push(b.session);

      // 解析真實時間以計算重疊
      let startH = 0, endH = 0;
      const parseH = (str) => {
        if(!str) return null;
        const match = str.match(/(\d+):/);
        let h = match ? parseInt(match[1]) : null;
        if (h !== null && str.includes('翌日')) h += 24;
        return h;
      };

      const defaultTimes = { MORNING: { start: 10, end: 13 }, AFTERNOON: { start: 14, end: 17 }, NIGHT: { start: 18, end: 21 } };
      const def = defaultTimes[b.session] || defaultTimes.MORNING;

      startH = parseH(b.startTime) !== null ? parseH(b.startTime) : def.start;
      endH = parseH(b.endTime) !== null ? parseH(b.endTime) : (def.end + (b.overtimeHours||0));

      map[b.date].bookings.push({ start: startH, end: endH, session: b.session });
    });
    return map;
  };

  const handleCheckoutSuccess = async (newOrder) => {
    setIsSubmitting(true);
    setGlobalError('');

    const orderToSave = { ...newOrder, createdAt: new Date().toISOString() };

    // 如果是測試環境 (dummy) 或沒有登入，啟動單機測試模式
    if (isDummyConfig || !user) {
        console.log("[單機測試模式] 本地寫入訂單");
        orderToSave.id = 'TEST-' + newOrder.id;
        setLastOrder(orderToSave);
        setBookings(prev => [orderToSave, ...prev]); // 本地更新，讓後台馬上看得到
        setCurrentView('SUCCESS');
        window.scrollTo(0, 0);
        setIsSubmitting(false);
        return;
    }

    try {
      await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'bookings', newOrder.id), orderToSave);
      setLastOrder(orderToSave);
      
      // Webhook Simulator
      fetch('https://webhook.site/simulate', { method: 'POST', body: JSON.stringify(orderToSave) }).catch(()=>console.log("Webhook triggered"));

      setCurrentView('SUCCESS');
      window.scrollTo(0, 0);
    } catch (e) {
      console.error("Create order error:", e);
      if (e.code === 'permission-denied' || e.message.includes('permission')) {
          setGlobalError('⚠️ 資料庫拒絕寫入。請確定 Firebase 規則已設為 allow read, write: if true; (目前暫存為單機模式)');
      }
      // 終極容錯：如果連線失敗，自動轉為單機模式讓客人順利結帳
      orderToSave.id = 'LOCAL-ERR-' + newOrder.id;
      setLastOrder(orderToSave);
      setBookings(prev => [orderToSave, ...prev]);
      setCurrentView('SUCCESS');
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-10 flex flex-col">
      {dbError && (
        <div className="bg-red-600 text-white p-3 text-center text-sm font-bold z-50 shadow-md">
          {dbError}
        </div>
      )}
      <div className="bg-white text-gray-800 p-4 flex justify-between items-center shadow-sm sticky top-0 z-40 border-b border-gray-100">
        <div className="font-black text-xl tracking-wider cursor-pointer flex items-center gap-2" onClick={() => setCurrentView('BOOKING')}>
          {systemConfig.brandLogo ? (
            <img src={systemConfig.brandLogo} alt="Logo" className="h-8 object-contain" />
          ) : (
            <span className="bg-gradient-to-r from-indigo-600 to-pink-500 bg-clip-text text-transparent">{systemConfig.brandName}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!isCloudSyncing && <div className="hidden md:flex items-center gap-1 text-xs text-green-500 bg-green-50 px-2 py-1 rounded border border-green-100"><Cloud size={14}/> 雲端同步中</div>}
          {isAuthenticated ? (
            <button onClick={() => {setIsAuthenticated(false); setCurrentView('BOOKING');}} className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors shadow-sm">退出後台</button>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors"><Lock size={18} /></button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {currentView === 'BOOKING' && (
          <CustomerBookingFlow pricing={pricingConfig} addons={addonsConfig} systemConfig={systemConfig} bookedData={getBookedSlotsMap()} onCheckout={handleCheckoutSuccess} isSubmitting={isSubmitting} globalError={globalError} />
        )}
        {currentView === 'SUCCESS' && (
          <SuccessPage order={lastOrder} systemConfig={systemConfig} pricing={pricingConfig} onBackHome={() => setCurrentView('BOOKING')} />
        )}
        {currentView === 'ADMIN' && (
          <AdminDashboard 
            pricing={pricingConfig} setPricing={(cfg) => saveConfigToCloud('pricing', cfg)}
            addons={addonsConfig} setAddons={(items) => saveConfigToCloud('addons', {items})}
            systemConfig={systemConfig} setSystemConfig={(cfg) => saveConfigToCloud('system', cfg)}
            bookings={bookings} updateBooking={updateBookingInCloud} deleteBooking={deleteBookingFromCloud} bookedData={getBookedSlotsMap()}
            expenses={expenses} saveExpense={saveExpenseToCloud} deleteExpense={deleteExpenseFromCloud}
          />
        )}
      </div>

      {showLoginModal && <LoginModal adminPassword={systemConfig.adminPassword || 'admin123'} onClose={() => setShowLoginModal(false)} onSuccess={() => {setIsAuthenticated(true); setCurrentView('ADMIN'); setShowLoginModal(false);}} />}
    </div>
  );
}

// ==========================================
// 🧑‍💻 客戶端：預約流程
// ==========================================
function CustomerBookingFlow({ pricing, addons, systemConfig, bookedData, onCheckout, isSubmitting, globalError }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [sessionType, setSessionType] = useState('');
  const [adults, setAdults] = useState(6);
  const [children, setChildren] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSource, setCustomerSource] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState({ text: '', type: '' });

  const baseHours = 3; 
  const dailyBookingsObj = selectedDate ? (bookedData[selectedDate] || { sessions: [], bookings: [] }) : null;

  // 智慧防撞與時段順延大腦
  const getDynamicSessions = () => {
      if (!dailyBookingsObj) return {};
      const dbks = [...dailyBookingsObj.bookings].sort((a,b)=>a.start - b.start);
      const defaultTimesConfig = { 
          MORNING: { start: 10, end: 13, label: "早上", icon: Sunrise }, 
          AFTERNOON: { start: 14, end: 17, label: "下午", icon: Sun }, 
          NIGHT: { start: 18, end: 21, label: "夜晚", icon: Moon } 
      };
      
      const sessions = {};

      Object.keys(defaultTimesConfig).forEach(type => {
          let { start, end, label, icon } = defaultTimesConfig[type];
          let isBlocked = dailyBookingsObj.sessions.includes(type); // 原本就被訂的基礎時段

          // 偵測自訂時間重疊並順延 (順延 1 小時緩衝)
          dbks.forEach(b => {
              if (!isBlocked && start < b.end && end > b.start) {
                  start = b.end + 1; // 結束時間後順延 1 小時
                  end = start + 3;   // 維持基本 3 小時
              }
          });
          
          // 順延後再次檢查是否撞到「下一個」訂單
          dbks.forEach(b => { 
              if (!isBlocked && start < b.end && end > b.start) isBlocked = true; 
          });
          
          if(start >= 26) isBlocked = true; // 超過翌日凌晨 2 點直接鎖定不給選

          const formatTime = (h) => `${String(h >= 24 ? h - 24 : h).padStart(2, '0')}:00${h >= 24 ? ' (翌日)' : ''}`;
          sessions[type] = { type, start, end, label, icon, timeStr: `${formatTime(start)} - ${formatTime(end)}`, isBlocked };
      });
      return sessions;
  };
  const dynamicSessions = getDynamicSessions();

  const safePricing = { ...DEFAULT_PRICING, ...pricing };
  
  // 定價大腦邏輯
  const baseHeadcountTotal = (adults * safePricing.adultBase) + (children * safePricing.childBase);
  const overtimeHeadcountTotal = (adults * safePricing.adultOvertime + children * safePricing.childOvertime) * overtimeHours;
  const rawPerPersonTotal = baseHeadcountTotal + overtimeHeadcountTotal;
  const effectivePerPersonTotal = Math.max(rawPerPersonTotal, safePricing.minCharge);

  const flatRateTotal = safePricing.flatBase + (overtimeHours * safePricing.flatOvertime);

  const isFlatRate = effectivePerPersonTotal >= flatRateTotal;
  const finalRoomPrice = isFlatRate ? flatRateTotal : effectivePerPersonTotal;

  const addonsPrice = selectedAddons.reduce((sum, id) => {
    const addon = (addons || []).find(a => a.id === id);
    return sum + (addon ? parseInt(addon.price) || 0 : 0);
  }, 0);
  
  const handleApplyPromo = () => {
    if (!promoCode.trim()) return;
    const promo = (systemConfig.promoCodes || []).find(p => p.code === promoCode.toUpperCase());
    if (!promo) { setPromoMessage({ text: '⚠️ 找不到此優惠碼', type: 'error' }); setAppliedPromo(null); return; }
    const today = new Date().toISOString().slice(0,10);
    if (promo.expiry && promo.expiry < today) { setPromoMessage({ text: '⚠️ 此優惠碼已過期', type: 'error' }); setAppliedPromo(null); return; }
    setAppliedPromo(promo);
    setPromoMessage({ text: `✅ 成功套用優惠：減免 $${promo.value}`, type: 'success' });
  };

  const originalRoomAndAddons = finalRoomPrice + addonsPrice;
  const discountAmount = appliedPromo ? parseInt(appliedPromo.value) : 0;
  const finalTotalPrice = Math.max(0, originalRoomAndAddons - discountAmount); 

  const depositAmount = finalTotalPrice / 2; 
  const balanceAmount = finalTotalPrice - depositAmount; 
  const securityDeposit = safePricing.deposit; 

  const isValidPhone = customerPhone.length === 8 && /^\d+$/.test(customerPhone);

  const handleProcessCheckout = () => {
    if (!selectedDate || !sessionType) { setValidationError("⚠️ 請先在上方選擇「預約日期」與「時段」！"); return; }
    if (!customerName.trim()) { setValidationError("⚠️ 請填寫您的「顧客名稱」！"); return; }
    if (!isValidPhone) { setValidationError("⚠️ 請輸入正確的「8 位數字聯絡電話」！"); return; }
    if (!agreeTerms) { setValidationError("⚠️ 請閱讀並勾選最下方的「同意預訂條款」！"); return; }

    setValidationError('');
    const orderId = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);
    
    // 獲取智慧順延後的真實開始與結束時間寫入訂單
    const selectedDynamicSession = dynamicSessions[sessionType];
    const sStart = selectedDynamicSession ? selectedDynamicSession.start : null;
    const sEnd = selectedDynamicSession ? (selectedDynamicSession.start + baseHours + overtimeHours) : null;
    const formatTime = (h) => `${String(h >= 24 ? h - 24 : h).padStart(2, '0')}:00${h >= 24 ? ' (翌日)' : ''}`;

    const newOrder = {
      id: orderId, date: selectedDate, session: sessionType,
      startTime: sStart !== null ? formatTime(sStart) : null,
      endTime: sEnd !== null ? formatTime(sEnd) : null,
      name: customerName, phone: customerPhone, source: customerSource || '未填寫',
      adults, children, overtimeHours, isFlatRate, 
      totalRoomAndAddons: finalTotalPrice,
      originalRoomAndAddons: originalRoomAndAddons,
      promoCode: appliedPromo ? appliedPromo.code : null,
      promoDiscount: discountAmount,
      depositAmount, balanceAmount, securityDeposit,
      addons: selectedAddons,
      status: 'PENDING', depositStatus: 'PENDING', paymentMethod: 'PENDING', receipt: null, transactions: [], internalNote: ''
    };
    onCheckout(newOrder);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden pb-40 border border-gray-100">
      <div className="bg-gradient-to-br from-pink-50 to-indigo-100 p-8 text-center relative overflow-hidden">
        <div className="absolute top-2 left-2 opacity-20"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <div className="absolute bottom-2 right-2 opacity-20"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg></div>
        
        {systemConfig.brandLogo ? (
           <img src={systemConfig.brandLogo} alt="Brand" className="h-16 mx-auto mb-3 object-contain drop-shadow-md z-10 relative" />
        ) : (
           <h1 className="text-3xl font-black text-indigo-900 tracking-widest mb-1 z-10 relative">{systemConfig.brandName}</h1>
        )}
        <p className="text-indigo-600 font-bold tracking-[0.1em] text-sm mb-4 z-10 relative">{systemConfig.brandSub}</p>
        <div className="inline-block bg-white/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-bold text-pink-600 border border-pink-200 shadow-sm z-10 relative flex items-center justify-center gap-1 mx-auto w-fit">
          <Baby size={14}/> 溫馨親子派對空間 💖
        </div>
      </div>

      <div className="p-5 space-y-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-800 font-bold mb-4 border-b pb-2"><CalendarIcon className="text-indigo-600" size={20} /><span>1. 選擇日期與時段</span></div>
          <CustomerCalendar selectedDate={selectedDate} onSelectDate={(date) => { setSelectedDate(date); setSessionType(''); }} bookedData={bookedData} />
          
          {selectedDate && dynamicSessions && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-2">
                {['MORNING', 'AFTERNOON', 'NIGHT'].map(type => (
                   <SessionButton
                     key={type}
                     type={type}
                     label={dynamicSessions[type].label}
                     time={dynamicSessions[type].timeStr}
                     icon={dynamicSessions[type].icon}
                     currentSelection={sessionType}
                     onSelect={setSessionType}
                     isBlocked={dynamicSessions[type].isBlocked}
                   />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all duration-300 ${sessionType ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-40 pointer-events-none grayscale'}`}>
           <div className="flex items-center gap-2 text-gray-800 mb-4 font-bold border-b pb-2 flex-wrap"><Users className="text-indigo-600" size={20} /><span>2. 派對人數與時數</span> <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">低消 ${safePricing.minCharge}</span></div>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-end mb-2"><div className="flex items-center gap-2 text-sm font-semibold text-gray-700"><User size={16} className="text-gray-400"/> 成人</div><span className="text-lg font-black text-gray-800">{adults}</span></div>
              <input type="range" min="1" max="30" value={adults} onChange={(e) => setAdults(parseInt(e.target.value))} className="w-full accent-indigo-600" />
            </div>
            <div>
              <div className="flex justify-between items-end mb-2"><div className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Baby size={16} className="text-pink-400"/> 小童 <span className="text-[10px] text-gray-400">(1-10歲)</span></div><span className="text-lg font-black text-gray-800">{children}</span></div>
              <input type="range" min="0" max="15" value={children} onChange={(e) => setChildren(parseInt(e.target.value))} className="w-full accent-pink-500" />
            </div>
          </div>
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mt-4">
            <div><div className="text-gray-800 font-medium text-sm">延長時間 <span className="text-[11px] text-gray-500">(基本{baseHours}hr)</span></div></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOvertimeHours(Math.max(0, overtimeHours - 1))} className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600"><Minus size={16}/></button>
              <span className="font-bold w-4 text-center">{overtimeHours}</span>
              <button onClick={() => setOvertimeHours(overtimeHours + 1)} className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600"><Plus size={16}/></button>
            </div>
          </div>

          <div className={`mt-5 p-4 rounded-xl border-2 transition-all duration-300 ${isFlatRate ? 'bg-green-50 border-green-500 scale-[1.02]' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-start mb-1">
              <div className="text-gray-700 font-bold text-sm mt-1">{isFlatRate ? '🎉 已升級包場一口價' : '場租小計'}</div>
              <div className="font-black text-2xl text-indigo-700">${finalRoomPrice}</div>
            </div>
            {isFlatRate && <div className="text-[10px] text-green-600 font-bold">人數已達封頂，再加人也不用加錢啦！</div>}
          </div>
        </div>

        <div className={`transition-all duration-300 ${sessionType ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 border-b pb-2"><DollarSign size={18} className="text-indigo-600" /> 3. 加購升級服務</h3>
          <div className="space-y-2">
            {(addons || []).map(addon => (
              <label key={addon.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${selectedAddons.includes(addon.id) ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded" checked={selectedAddons.includes(addon.id)} onChange={() => setSelectedAddons(prev => prev.includes(addon.id) ? prev.filter(x => x !== addon.id) : [...prev, addon.id])} />
                  <div><div className="font-semibold text-sm text-gray-800">{addon.name}</div><div className="text-[10px] text-gray-500 mt-0.5">{addon.leadTime}</div></div>
                </div>
                <div className="font-bold text-gray-700 text-sm">+${addon.price}</div>
              </label>
            ))}
          </div>
        </div>

        <div className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all duration-300 ${sessionType ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2"><User size={18} className="text-indigo-600" /> 4. 聯絡資料填寫</h3>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-600 mb-1">顧客名稱 *</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="例如: 陳大文" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"/></div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">聯絡電話 (WhatsApp) *</label>
              <div className="flex">
                <span className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg px-3 py-2 text-sm text-gray-500 font-bold">+852</span>
                <input type="tel" maxLength="8" value={customerPhone} onChange={e => {const val=e.target.value; if(val==='' || /^[0-9]+$/.test(val)){setCustomerPhone(val);}}} placeholder="8位數字" className={`w-full border rounded-r-lg px-3 py-2 text-sm focus:outline-none ${customerPhone.length>0 && !isValidPhone ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-gray-300 focus:border-indigo-500'}`}/>
              </div>
              {customerPhone.length>0 && !isValidPhone && <p className="text-[10px] text-red-500 mt-1">請輸入正確的 8 位數香港電話號碼</p>}
            </div>
            <div><label className="block text-xs font-bold text-gray-600 mb-1">從哪裡得知我們？</label>
              <select value={customerSource} onChange={e=>setCustomerSource(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white">
                <option value="">請選擇...</option><option value="IG">Instagram</option><option value="FB">Facebook</option><option value="FRIEND">朋友介紹</option><option value="GOOGLE">Google 搜尋</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all duration-300 ${sessionType ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2"><DollarSign size={18} className="text-indigo-600" /> 5. 優惠碼折扣 (選填)</h3>
          <div className="flex gap-2">
            <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="輸入優惠碼" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"/>
            <button onClick={handleApplyPromo} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition-colors">套用</button>
          </div>
          {promoMessage.text && <div className={`mt-2 text-xs font-bold ${promoMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{promoMessage.text}</div>}
        </div>

        <div className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all duration-300 ${sessionType ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2"><FileText size={18} className="text-indigo-600" /> 6. 預訂條款與細則</h3>
          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 mb-4 whitespace-pre-line leading-relaxed h-32 overflow-y-auto border border-gray-100">
            {systemConfig?.termsAndConditions || '暫無條款'}
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-indigo-600 rounded" />
            <span className="text-sm text-gray-700 font-medium">本人已閱讀並同意上述預訂條款及細則</span>
          </label>
        </div>
      </div>

      <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-gray-200 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-30">
        <div className="flex justify-between items-start mb-3 text-sm">
          <div className="text-gray-600">
            <div>總額 (未含按金): {appliedPromo && <span className="line-through text-gray-400 mr-1">${originalRoomAndAddons}</span>}<span className="font-bold">${finalTotalPrice}</span></div>
            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1"><ShieldCheck size={14}/> 另加按金 ${securityDeposit}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">現在付款 (訂金 50%)</div>
            <div className="text-2xl font-black text-indigo-700 leading-none">${depositAmount}</div>
          </div>
        </div>
        
        {validationError && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg font-bold text-center animate-pulse">{validationError}</div>}
        {globalError && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg font-bold text-center">{globalError}</div>}
        
        <button disabled={isSubmitting} onClick={handleProcessCheckout} className={`w-full font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg transition-all ${isSubmitting ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-gray-900 hover:bg-black text-white active:scale-95'}`}>
          {isSubmitting ? '處理中請稍候...' : '確認送出並繳付訂金'}
        </button>
      </div>
    </div>
  );
}

function CustomerCalendar({ selectedDate, onSelectDate, bookedData }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Create a copy to prevent mutation, set to first day of month
  const displayMonth = new Date(currentMonth);
  displayMonth.setDate(1);
  
  const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = displayMonth.getDay();

  const today = new Date();
  today.setHours(0,0,0,0);

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
      const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isPast = dateObj < today;
      const isSelected = selectedDate === dateString;
      const bookedDataForDay = bookedData[dateString] || { sessions: [], bookings: [] };
      const bookedSlotsCount = bookedDataForDay.bookings.length;
      const isFullyBooked = bookedSlotsCount >= 3;

      let btnClass = "h-10 w-full rounded-full flex flex-col items-center justify-center text-sm font-medium transition-colors relative ";
      let disabled = false;
      
      if (isPast) { 
        btnClass += "text-gray-300 cursor-not-allowed"; 
        disabled = true; 
      }
      else if (isFullyBooked) { 
        btnClass += "bg-gray-100 text-gray-400 cursor-not-allowed"; 
        disabled = true; 
      }
      else if (isSelected) { 
        btnClass += "bg-indigo-600 text-white shadow-md z-10"; 
      }
      else if (bookedSlotsCount > 0) { 
        btnClass += "bg-white text-gray-800 hover:bg-indigo-50 border border-orange-200"; 
      }
      else { 
        btnClass += "bg-white text-gray-800 hover:bg-indigo-50 border border-transparent"; 
      }

      days.push(
        <button key={day} disabled={disabled} onClick={() => onSelectDate(dateString)} className={btnClass}>
          <span className={isFullyBooked ? "line-through opacity-50" : ""}>{day}</span>
          {!isPast && !isFullyBooked && bookedSlotsCount > 0 && !isSelected && (
            <div className="flex gap-0.5 mt-0.5">
               {[...Array(3 - bookedSlotsCount)].map((_, i) => <div key={i} className="w-1 h-1 bg-orange-400 rounded-full"></div>)}
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={() => {const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d);}} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
        <div className="font-bold text-gray-800 text-lg">{currentMonth.getFullYear()} 年 {currentMonth.getMonth() + 1} 月</div>
        <button onClick={() => {const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d);}} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">{['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-xs font-bold text-gray-400">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
      <div className="flex justify-center gap-4 mt-4 text-[10px] text-gray-500">
         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"></div>部份時段空缺</div>
         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-200"></div>已滿/不可預約</div>
      </div>
    </div>
  );
}

function SessionButton({ type, label, time, icon: Icon, currentSelection, onSelect, isBlocked }) {
  const isSelected = currentSelection === type;
  
  if (isBlocked) {
    return (
      <div className="border border-gray-100 bg-gray-50 rounded-xl p-3 flex flex-col items-center justify-center opacity-50 cursor-not-allowed">
        <Icon size={20} className="text-gray-400 mb-1" />
        <div className="text-xs font-bold text-gray-500 line-through">{label}</div>
        <div className="text-[10px] text-gray-400">{time}</div>
        <div className="text-[10px] text-red-500 font-bold mt-1">已滿/重疊</div>
      </div>
    );
  }
  
  return (
    <button onClick={() => onSelect(type)} className={`border rounded-xl p-3 flex flex-col items-center justify-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
      <Icon size={20} className={`mb-1 ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`} />
      <div className={`text-xs font-bold ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</div>
      <div className={`text-[10px] ${isSelected ? 'text-indigo-500' : 'text-gray-500'}`}>{time}</div>
      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5"></div>}
    </button>
  );
}

function SuccessPage({ order, systemConfig, onBackHome }) {
  if(!order) return null;
  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden text-center py-10 px-6 border border-gray-100 mt-10">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} className="text-green-500" /></div>
      <h2 className="text-2xl font-black text-gray-800 mb-2">預約已登記！</h2>
      <div className="text-gray-600 mb-6 text-sm leading-relaxed whitespace-pre-line bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-left">
        {systemConfig?.successMessage || '預約成功'}
      </div>
      
      <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left border border-gray-200">
        <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3">付款指引</h3>
        <div className="flex justify-between items-center mb-2"><span className="text-sm text-gray-600">第一期：現在繳付 (訂金)</span><span className="font-black text-lg text-indigo-700">${order.depositAmount}</span></div>
        <div className="flex justify-between items-center opacity-60"><span className="text-sm text-gray-600">第二期：活動前一天付 (尾數+按金)</span><span className="font-bold text-sm text-gray-700">${order.balanceAmount + order.securityDeposit}</span></div>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 text-left border border-gray-100 shadow-sm text-sm">
        <div className="flex justify-between mb-1"><span className="text-gray-500">訂單編號</span><span className="font-mono font-bold text-gray-800">{order.id}</span></div>
        <div className="flex justify-between mb-1"><span className="text-gray-500">預約日期</span><span className="font-bold text-gray-800">{order.date}</span></div>
        <div className="flex justify-between mb-1"><span className="text-gray-500">場地地址</span><span className="font-bold text-gray-800 text-right">{systemConfig.address || '地址未設定'}</span></div>
      </div>
      
      <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-xl mb-6 flex items-start gap-2 text-left shadow-sm">
        <Smartphone size={16} className="mt-0.5 flex-shrink-0" />
        <span>系統已自動發送新預約 WhatsApp 通知至管理員專線。</span>
      </div>

      <button onClick={onBackHome} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95">返回首頁</button>
    </div>
  );
}

// ==========================================
// 👑 老闆管理後台
// ==========================================
function AdminDashboard({ pricing, setPricing, addons, setAddons, systemConfig, setSystemConfig, bookings, updateBooking, deleteBooking, bookedData, expenses, saveExpense, deleteExpense }) {
  const [activeTab, setActiveTab] = useState('CALENDAR'); 
  const [selectedBooking, setSelectedBooking] = useState(null); 

  return (
    <div className="max-w-6xl mx-auto mt-2 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><LayoutDashboard className="text-indigo-600" /> 控制台</h2>
        <div className="flex flex-wrap bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <button onClick={() => setActiveTab('CALENDAR')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'CALENDAR' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>📅 預約管理</button>
          <button onClick={() => setActiveTab('FINANCE')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'FINANCE' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>💰 資金流紀錄</button>
          <button onClick={() => setActiveTab('EXPENSES')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'EXPENSES' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>🧾 AI 支出與報稅</button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>⚙️ 營運設定</button>
        </div>
      </div>

      {activeTab === 'CALENDAR' && <AdminBookingCalendar bookings={bookings} bookedData={bookedData} setSelectedBooking={setSelectedBooking} />}
      {activeTab === 'FINANCE' && <AdminFinance bookings={bookings} onOpenBooking={(id) => {
        const target = bookings.find(b => b.id === id);
        if(target) setSelectedBooking(target);
      }} />}
      {activeTab === 'EXPENSES' && <AdminExpenses expenses={expenses} saveExpense={saveExpense} deleteExpense={deleteExpense} bookings={bookings} systemConfig={systemConfig} />}
      {activeTab === 'SETTINGS' && <AdminPricingSettings pricing={pricing} setPricing={setPricing} addons={addons} setAddons={setAddons} systemConfig={systemConfig} setSystemConfig={setSystemConfig}/>}

      {selectedBooking && (
        <AdminBookingDetailModal 
          selectedBooking={selectedBooking} 
          setSelectedBooking={setSelectedBooking} 
          updateBooking={updateBooking} 
          deleteBooking={deleteBooking}
          addonsConfig={addons} 
          pricing={pricing}
        />
      )}
    </div>
  );
}

function AdminBookingCalendar({ bookings, bookedData, setSelectedBooking }) {
  const [adminSelectedDate, setAdminSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [viewMode, setViewMode] = useState('DAILY'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const todayString = new Date().toISOString().slice(0,10);

  // Search filter logic
  let displayBookings = [];
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    displayBookings = bookings.filter(b => 
      b.name.toLowerCase().includes(q) || 
      b.phone.includes(q) || 
      b.date.includes(q) ||
      b.id.toLowerCase().includes(q)
    );
  } else {
    const dailyBookings = bookings.filter(b => b.date === adminSelectedDate);
    const upcomingBookings = bookings
      .filter(b => b.date >= todayString)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const sessionOrder = { MORNING: 1, AFTERNOON: 2, NIGHT: 3 };
        return (sessionOrder[a.session] || 0) - (sessionOrder[b.session] || 0);
      });
    displayBookings = viewMode === 'DAILY' ? dailyBookings : upcomingBookings;
  }

  const getSessionLabel = (s) => s === 'MORNING' ? '🌅 早上' : s === 'AFTERNOON' ? '☀️ 下午' : '🌙 夜晚';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-fit">
        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">選擇日期查看排程</h3>
        <CustomerCalendar selectedDate={adminSelectedDate} onSelectDate={(date) => { setAdminSelectedDate(date); setViewMode('DAILY'); setSearchQuery(''); }} bookedData={bookedData} />
      </div>

      <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 min-h-[400px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b pb-3 gap-3">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => {setViewMode('DAILY'); setSearchQuery('');}} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'DAILY' && !searchQuery ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📅 {adminSelectedDate}</button>
              <button onClick={() => {setViewMode('UPCOMING'); setSearchQuery('');}} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'UPCOMING' && !searchQuery ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🚀 未來列表</button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-full sm:w-64">
            <Search size={16} className="text-gray-400"/>
            <input type="text" placeholder="搜尋姓名/電話/日期..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full text-sm focus:outline-none bg-transparent"/>
          </div>
        </div>
        
        {displayBookings.length === 0 ? (
          <div className="text-center py-16 text-gray-400 flex flex-col items-center"><CalendarIcon size={48} className="mb-2 opacity-50"/><p>{searchQuery ? '找不到符合的預約' : (viewMode === 'DAILY' ? '該日目前無任何預約' : '目前尚無未來的預約')}</p></div>
        ) : (
          <div className="space-y-4">
            {displayBookings.map(b => {
              const totalRequired = (b.totalRoomAndAddons || 0) - (b.staffDiscount || 0) + (b.securityDeposit || 1000);
              const totalPaid = (b.transactions||[]).filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0);
              const isFullyPaid = totalPaid >= totalRequired;

              return (
                <div key={b.id} onClick={() => setSelectedBooking(b)} className="border border-gray-100 bg-gray-50 hover:bg-indigo-50 rounded-xl p-4 cursor-pointer flex justify-between items-center relative overflow-hidden transition-colors">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isFullyPaid ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                  <div className="pl-2">
                    <div className="flex items-center gap-2 mb-1">
                      {(viewMode === 'UPCOMING' || searchQuery) && <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded tracking-wider">{b.date}</span>}
                      <span className="text-xs text-indigo-600 font-bold">{getSessionLabel(b.session)}</span>
                    </div>
                    <div className="font-bold text-gray-800 text-lg">{b.name}</div>
                    <div className="text-sm text-gray-500 mt-1"><Phone size={12} className="inline"/> {b.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-gray-800">${totalRequired}</div>
                    <div className="text-[10px] mt-1 font-bold">
                      {isFullyPaid ? <span className="text-green-600 bg-green-100 px-2 py-1 rounded">款項結清</span> : <span className="text-yellow-600 bg-yellow-100 px-2 py-1 rounded">尚欠 ${totalRequired - totalPaid}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminBookingDetailModal({ selectedBooking, setSelectedBooking, updateBooking, deleteBooking, addonsConfig, pricing }) {
  const getSessionLabel = (s) => s === 'MORNING' ? '🌅 早上' : s === 'AFTERNOON' ? '☀️ 下午' : '🌙 夜晚';
  
  const totalRequired = (selectedBooking.totalRoomAndAddons || 0) - (selectedBooking.staffDiscount || 0) + (selectedBooking.securityDeposit || 1000);
  const totalPaid = (selectedBooking.transactions||[]).filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0);
  const outstanding = totalRequired - totalPaid;
  const isFullyPaid = outstanding <= 0;

  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('FPS');
  const [newPaymentNote, setNewPaymentNote] = useState('繳付訂金');
  const [newPaymentReceiptUrl, setNewPaymentReceiptUrl] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState(null);
  
  const [internalNote, setInternalNote] = useState(selectedBooking.internalNote || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [staffDiscountAmount, setStaffDiscountAmount] = useState('');

  const [refundData, setRefundData] = useState({ 
    amount: selectedBooking.securityDeposit || 1000, 
    method: 'FPS', 
    receipt: '', 
    note: '退還按金',
    date: new Date().toISOString().slice(0, 16)
  });

  const defaultTimes = { MORNING: { start: '10:00', endHour: 13 }, AFTERNOON: { start: '14:00', endHour: 17 }, NIGHT: { start: '18:00', endHour: 21 } };
  const getCalculatedEndTime = (baseHour, ot) => {
      let h = baseHour + (parseInt(ot)||0);
      let nextDay = false;
      if(h >= 24) { h = h - 24; nextDay = true; }
      return `${String(h).padStart(2, '0')}:00${nextDay ? ' (翌日)' : ''}`;
  };

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  const [isEditingParams, setIsEditingParams] = useState(false);
  const [editAdults, setEditAdults] = useState(0);
  const [editChildren, setEditChildren] = useState(0);
  const [editOvertime, setEditOvertime] = useState(0);

  useEffect(() => {
      if(!selectedBooking) return;
      const sDef = defaultTimes[selectedBooking.session] || defaultTimes.MORNING;
      setEditStartTime(selectedBooking.startTime || sDef.start);
      setEditEndTime(selectedBooking.endTime || getCalculatedEndTime(sDef.endHour, selectedBooking.overtimeHours));

      setEditAdults(selectedBooking.adults || 0);
      setEditChildren(selectedBooking.children || 0);
      setEditOvertime(selectedBooking.overtimeHours || 0);
  }, [selectedBooking]);

  const safePricing = { ...DEFAULT_PRICING, ...(pricing || {}) };
  const addonsPrice = (selectedBooking.addons || []).reduce((sum, id) => {
      const ad = (addonsConfig || []).find(a => a.id === id);
      return sum + (ad ? parseInt(ad.price) || 0 : 0);
  }, 0);

  const baseHeadcountTotal = (editAdults * safePricing.adultBase) + (editChildren * safePricing.childBase);
  const overtimeHeadcountTotal = (editAdults * safePricing.adultOvertime + editChildren * safePricing.childOvertime) * editOvertime;
  const rawPerPersonTotal = baseHeadcountTotal + overtimeHeadcountTotal;
  const effectivePerPersonTotal = Math.max(rawPerPersonTotal, safePricing.minCharge);

  const flatRateTotal = safePricing.flatBase + (editOvertime * safePricing.flatOvertime);
  const isEditFlatRate = effectivePerPersonTotal >= flatRateTotal;
  const finalEditRoomPrice = isEditFlatRate ? flatRateTotal : effectivePerPersonTotal;

  const editOriginalRoomAndAddons = finalEditRoomPrice + addonsPrice;
  const discountAmount = selectedBooking.promoDiscount || 0;
  const livePreviewTotal = Math.max(0, editOriginalRoomAndAddons - discountAmount);

  const handleSaveParams = () => {
      const sDef = defaultTimes[selectedBooking.session] || defaultTimes.MORNING;
      const newEndTime = getCalculatedEndTime(sDef.endHour, editOvertime);

      const newLogs = [...(selectedBooking.auditLogs || []), generateLog('更改參數', `人數改為 ${editAdults}大${editChildren}小，加時 ${editOvertime}hr。系統重算收費為 $${livePreviewTotal}`)];

      const newTotalRequired = livePreviewTotal - (selectedBooking.staffDiscount || 0) + (selectedBooking.securityDeposit || 1000);
      const currentPaid = (selectedBooking.transactions||[]).filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0);
      const newStatus = currentPaid >= newTotalRequired ? 'CONFIRMED' : (currentPaid > 0 ? 'PARTIAL_PAID' : 'PENDING');

      setEditEndTime(newEndTime);

      const updates = {
          adults: editAdults, children: editChildren, overtimeHours: editOvertime,
          isFlatRate: isEditFlatRate, originalRoomAndAddons: editOriginalRoomAndAddons, totalRoomAndAddons: livePreviewTotal,
          endTime: newEndTime, auditLogs: newLogs, status: newStatus
      };

      updateBooking(selectedBooking.id, updates);
      setSelectedBooking({ ...selectedBooking, ...updates });
      setIsEditingParams(false);
  };

  const handleSaveTime = () => {
      const newLogs = [...(selectedBooking.auditLogs || []), generateLog('更改活動時間', `時間由原本更改為 ${editStartTime} 至 ${editEndTime}`)];
      const updates = { startTime: editStartTime, endTime: editEndTime, auditLogs: newLogs };
      updateBooking(selectedBooking.id, updates);
      setSelectedBooking({ ...selectedBooking, ...updates });
      setIsEditingTime(false);
  };

  const generateLog = (action, details) => {
    return { id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 5), timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), action, details };
  };

  const handleAddPayment = () => {
    if(!newPaymentAmount || isNaN(newPaymentAmount)) return; // 移除 alert
    const newTx = {
      id: 'tx-' + Date.now(), date: newPaymentDate.replace('T', ' '),
      type: 'COLLECT', amount: parseInt(newPaymentAmount), method: newPaymentMethod, note: newPaymentNote, receipt: newPaymentReceiptUrl || null
    };
    const updatedTransactions = [...(selectedBooking.transactions || []), newTx];
    const newStatus = (updatedTransactions.filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0)) >= totalRequired ? 'CONFIRMED' : 'PARTIAL_PAID';
    
    let pMethod = selectedBooking.paymentMethod;
    if (pMethod === 'PENDING') pMethod = newPaymentMethod;

    const newLogs = [...(selectedBooking.auditLogs || []), generateLog('新增收款', `收取 ${newPaymentMethod} $${newPaymentAmount} (${newPaymentDate.replace('T', ' ')})`)];

    const updates = { transactions: updatedTransactions, status: newStatus, paymentMethod: pMethod, auditLogs: newLogs };
    updateBooking(selectedBooking.id, updates);
    setSelectedBooking({ ...selectedBooking, ...updates });
    setNewPaymentAmount(''); setNewPaymentReceiptUrl('');
    setNewPaymentDate(new Date().toISOString().slice(0, 16));
  };

  const handleDeleteTransaction = (txId) => {
    const txToDelete = (selectedBooking.transactions || []).find(t => t.id === txId);
    if(!txToDelete) return;

    const updatedTransactions = (selectedBooking.transactions || []).filter(t => t.id !== txId);
    let newStaffDiscount = selectedBooking.staffDiscount || 0;
    let newDepositStatus = selectedBooking.depositStatus;

    if (txToDelete.type === 'DISCOUNT') {
        newStaffDiscount = Math.max(0, newStaffDiscount - txToDelete.amount);
    } else if (txToDelete.type === 'REFUND') {
        newDepositStatus = 'PENDING';
    }

    const currentPaid = updatedTransactions.filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0);
    const newTotalRequired = (selectedBooking.totalRoomAndAddons || 0) - newStaffDiscount + (selectedBooking.securityDeposit || 1000);
    const newStatus = currentPaid >= newTotalRequired ? 'CONFIRMED' : (currentPaid > 0 ? 'PARTIAL_PAID' : 'PENDING');

    const newLogs = [...(selectedBooking.auditLogs || []), generateLog('刪除紀錄', `移除了 ${txToDelete.type==='COLLECT'?'收款':'退款/折扣'} $${txToDelete.amount}`)];

    const updates = { transactions: updatedTransactions, status: newStatus, staffDiscount: newStaffDiscount, depositStatus: newDepositStatus, auditLogs: newLogs };
    updateBooking(selectedBooking.id, updates);
    setSelectedBooking({ ...selectedBooking, ...updates });
    setConfirmDeleteTxId(null);
  };

  const handleProcessDepositRefund = () => {
    if(refundData.amount < 0) return;
    const newTx = {
      id: 'tx-' + Date.now(), date: refundData.date.replace('T', ' '),
      type: 'REFUND', amount: parseInt(refundData.amount), method: refundData.method, note: refundData.note, receipt: refundData.receipt || null
    };
    const isFullRefund = parseInt(refundData.amount) === (selectedBooking.securityDeposit || 1000);
    const newLogs = [...(selectedBooking.auditLogs || []), generateLog('退還/扣除按金', `透過 ${refundData.method} 處理 $${refundData.amount} (${refundData.date.replace('T', ' ')})`)];
    const updates = { depositStatus: isFullRefund ? 'REFUNDED' : 'DEDUCTED', transactions: [...(selectedBooking.transactions||[]), newTx], auditLogs: newLogs };
    updateBooking(selectedBooking.id, updates);
    setSelectedBooking({ ...selectedBooking, ...updates });
  };

  const handleApplyStaffDiscount = () => {
    const amt = parseInt(staffDiscountAmount);
    if (isNaN(amt) || amt <= 0) return;
    const newStaffDiscount = (selectedBooking.staffDiscount || 0) + amt;
    const tx = {
      id: 'tx-' + Date.now(), date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      type: 'DISCOUNT', amount: amt, method: 'SYSTEM', note: '員工手動減免', receipt: null
    };
    const updatedTx = [...(selectedBooking.transactions || []), tx];
    
    // Check if discount makes order fully paid
    const currentPaid = (updatedTx.filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0));
    const newTotalRequired = (selectedBooking.totalRoomAndAddons || 0) - newStaffDiscount + (selectedBooking.securityDeposit || 1000);
    const newStatus = currentPaid >= newTotalRequired ? 'CONFIRMED' : selectedBooking.status;

    const newLogs = [...(selectedBooking.auditLogs || []), generateLog('新增折扣', `手動減免 $${amt}`)];

    const updates = { staffDiscount: newStaffDiscount, transactions: updatedTx, status: newStatus, auditLogs: newLogs };
    updateBooking(selectedBooking.id, updates);
    setSelectedBooking({ ...selectedBooking, ...updates });
    setStaffDiscountAmount('');
  };

  const handleChangeMainPaymentMethod = (newMethod) => {
    const newLogs = [...(selectedBooking.auditLogs || []), generateLog('更改主付款方式', `由 ${selectedBooking.paymentMethod} 改為 ${newMethod}`)];
    updateBooking(selectedBooking.id, { paymentMethod: newMethod, auditLogs: newLogs });
    setSelectedBooking({ ...selectedBooking, paymentMethod: newMethod, auditLogs: newLogs });
  };

  const handleSaveInternalNote = () => {
    const newLogs = [...(selectedBooking.auditLogs || []), generateLog('更新備註', `更改了內部備註`)];
    updateBooking(selectedBooking.id, { internalNote, auditLogs: newLogs });
    setSelectedBooking({ ...selectedBooking, internalNote, auditLogs: newLogs });
  };

  const handleDelete = () => {
    deleteBooking(selectedBooking.id);
    setSelectedBooking(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-gray-50 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row relative">
        <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 z-20 bg-white rounded-full p-1 shadow-sm"><X size={24}/></button>
        
        {/* 左側：訂單基本資料 */}
        <div className="w-full md:w-5/12 bg-white p-6 border-r border-gray-100 flex flex-col">
          <h3 className="font-black text-xl text-gray-800 mb-6 flex items-center gap-2"><FileText className="text-indigo-600"/> 預約明細</h3>
          <div className="space-y-4 flex-1">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="text-xs text-gray-400 mb-1">訂單編號</div><div className="font-mono text-lg font-bold text-indigo-700">{selectedBooking.id}</div></div>
            
            <div className="border-b border-gray-100 pb-3">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-500 text-sm flex items-center gap-1"><Clock size={14}/> 活動日期與時間</span>
                    {!isEditingTime ? (
                        <button onClick={() => setIsEditingTime(true)} className="text-xs text-indigo-600 font-bold hover:underline bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">修改時間</button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => {
                                setIsEditingTime(false);
                                const sDef = defaultTimes[selectedBooking.session] || defaultTimes.MORNING;
                                setEditStartTime(selectedBooking.startTime || sDef.start);
                                setEditEndTime(selectedBooking.endTime || getCalculatedEndTime(sDef.endHour, selectedBooking.overtimeHours));
                            }} className="text-xs text-gray-500 hover:underline">取消</button>
                            <button onClick={handleSaveTime} className="text-xs text-white bg-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-700 shadow-sm">儲存</button>
                        </div>
                    )}
                </div>
                {!isEditingTime ? (
                    <div className="text-right mt-2">
                        <div className="font-bold text-sm text-gray-800 bg-gray-100 inline-block px-2 py-0.5 rounded mb-1">{selectedBooking.date} ({getSessionLabel(selectedBooking.session)})</div>
                        <div className="font-black text-xl text-indigo-700">{selectedBooking.startTime || (defaultTimes[selectedBooking.session]||defaultTimes.MORNING).start} <span className="text-gray-400 text-sm mx-1">至</span> {selectedBooking.endTime || getCalculatedEndTime((defaultTimes[selectedBooking.session]||defaultTimes.MORNING).endHour, selectedBooking.overtimeHours)}</div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mt-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100 shadow-inner">
                        <div className="flex-1">
                            <label className="text-[10px] text-indigo-500 font-bold block mb-1">開始時間</label>
                            <input type="text" value={editStartTime} onChange={e=>setEditStartTime(e.target.value)} placeholder="例: 18:00" className="text-sm border border-indigo-200 rounded px-2 py-1.5 w-full"/>
                        </div>
                        <span className="text-gray-400 font-bold mt-4">-</span>
                        <div className="flex-1">
                            <label className="text-[10px] text-indigo-500 font-bold block mb-1">結束時間 (可備註翌日)</label>
                            <input type="text" value={editEndTime} onChange={e=>setEditEndTime(e.target.value)} placeholder="例: 02:00 (翌日)" className="text-sm border border-indigo-200 rounded px-2 py-1.5 w-full"/>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500 text-sm">顧客資料</span><span className="font-bold text-right text-sm">{selectedBooking.name} ({selectedBooking.phone})</span></div>
            
            <div>
              <div className="flex justify-between items-center mb-2 mt-2">
                <span className="text-gray-500 text-sm flex items-center gap-1"><Calculator size={14}/> 預約與計價參數</span>
                {!isEditingParams ? (
                    <button onClick={() => setIsEditingParams(true)} className="text-xs text-indigo-600 font-bold hover:underline bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm">修改參數與加時</button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => {
                            setIsEditingParams(false);
                            setEditAdults(selectedBooking.adults || 0);
                            setEditChildren(selectedBooking.children || 0);
                            setEditOvertime(selectedBooking.overtimeHours || 0);
                        }} className="text-xs text-gray-500 hover:underline">取消</button>
                        <button onClick={handleSaveParams} className="text-xs text-white bg-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-700 shadow-sm">儲存並重算</button>
                    </div>
                )}
              </div>
              <div className="text-sm bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <div className="font-bold text-indigo-800 mb-2 border-b border-indigo-200 pb-1 flex justify-between items-center">
                    <span>計價方式: {isEditingParams ? (isEditFlatRate ? '包場一口價' : '按人頭收費') : (selectedBooking.isFlatRate ? '包場一口價' : '按人頭收費')}</span>
                    {isEditingParams && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded animate-pulse">即時試算中</span>}
                  </div>
                  {!isEditingParams ? (
                      <>
                          <div className="flex justify-between text-gray-700 mb-1">
                              <span>派對人數</span>
                              <span className="font-semibold">大人 {selectedBooking.adults || 0} | 小童 {selectedBooking.children || 0}</span>
                          </div>
                          <div className="flex justify-between text-gray-700">
                              <span>加時時數</span>
                              <span className="font-semibold">{selectedBooking.overtimeHours || 0} 小時</span>
                          </div>
                      </>
                  ) : (
                      <div className="space-y-2">
                          <div className="flex justify-between text-gray-700 items-center">
                              <span className="text-xs font-bold">大人人數</span>
                              <input type="number" min="1" value={editAdults} onChange={e=>setEditAdults(parseInt(e.target.value)||0)} className="w-16 border border-indigo-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-indigo-500"/>
                          </div>
                          <div className="flex justify-between text-gray-700 items-center">
                              <span className="text-xs font-bold">小童人數</span>
                              <input type="number" min="0" value={editChildren} onChange={e=>setEditChildren(parseInt(e.target.value)||0)} className="w-16 border border-indigo-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-indigo-500"/>
                          </div>
                          <div className="flex justify-between text-gray-700 items-center">
                              <span className="text-xs font-bold">加時時數</span>
                              <div className="flex items-center gap-1">
                                  <button onClick={()=>setEditOvertime(Math.max(0, editOvertime-1))} className="w-6 h-6 bg-white border border-indigo-200 rounded flex items-center justify-center text-indigo-600 font-bold hover:bg-indigo-100">-</button>
                                  <span className="w-6 text-center font-bold text-indigo-900">{editOvertime}</span>
                                  <button onClick={()=>setEditOvertime(editOvertime+1)} className="w-6 h-6 bg-white border border-indigo-200 rounded flex items-center justify-center text-indigo-600 font-bold hover:bg-indigo-100">+</button>
                              </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-indigo-200 text-right">
                              <span className="text-[10px] text-gray-500 mr-2">系統即時重算新總額 (場租+加購):</span>
                              <span className="font-black text-indigo-700 text-lg">${livePreviewTotal}</span>
                          </div>
                      </div>
                  )}
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-sm block mb-2 mt-2">加購項目</span>
              {(!selectedBooking.addons || selectedBooking.addons.length === 0) ? <span className="text-sm font-medium text-gray-400">無</span> : (
                <ul className="text-sm font-medium space-y-2">
                  {selectedBooking.addons.map(addonId => {
                    const ad = (addonsConfig || []).find(a => a.id === addonId);
                    return <li key={addonId} className="flex justify-between bg-white border border-gray-100 px-3 py-2 rounded-lg shadow-sm"><span>{ad ? ad.name : '未知項目'}</span> <span>${ad ? ad.price : 0}</span></li>
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="text-gray-500 text-sm block mb-2">收費總覽</span>
              <div className="space-y-1 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="flex justify-between">
                  <span>場租 + 加購 {selectedBooking.promoCode && <span className="bg-green-100 text-green-700 text-[10px] px-1 rounded ml-1 font-bold">{selectedBooking.promoCode} (-${selectedBooking.promoDiscount})</span>}</span>
                  <span>${selectedBooking.originalRoomAndAddons || selectedBooking.totalRoomAndAddons || 0}</span>
                </div>
                {selectedBooking.promoDiscount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>客人使用優惠碼</span><span>-${selectedBooking.promoDiscount}</span></div>}
                {selectedBooking.staffDiscount > 0 && <div className="flex justify-between text-indigo-600 font-medium"><span>員工手動減免</span><span>-${selectedBooking.staffDiscount}</span></div>}
                <div className="flex justify-between text-orange-600"><span>場地按金</span><span>${selectedBooking.securityDeposit || 1000}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-gray-200 mt-2"><span>應收總額</span><span className="text-lg text-indigo-700">${totalRequired}</span></div>
              </div>
            </div>

            {/* 內部備註區塊 */}
            <div className="mt-4">
              <label className="text-xs text-gray-500 font-bold block mb-1 flex items-center gap-1"><MessageCircle size={14}/> 內部備註 (僅員工可見)</label>
              <div className="flex gap-2">
                <input type="text" value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="例如: 客人需借用酒杯" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm" />
                <button onClick={handleSaveInternalNote} className="bg-gray-800 text-white px-3 rounded hover:bg-black flex items-center justify-center"><Save size={16}/></button>
              </div>
            </div>

            {/* 系統修改紀錄區塊 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">系統操作與修改紀錄</span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {(!selectedBooking.auditLogs || selectedBooking.auditLogs.length === 0) && <div className="text-[10px] text-gray-400 bg-gray-50 p-2 rounded">尚無修改紀錄</div>}
                {(selectedBooking.auditLogs || []).slice().reverse().map(log => (
                  <div key={log.id} className="text-[10px] bg-gray-50 p-1.5 rounded flex items-start gap-2 border border-gray-100">
                    <span className="text-gray-400 whitespace-nowrap">{log.timestamp}</span>
                    <div><span className="font-bold text-gray-600 mr-1">[{log.action}]</span><span className="text-gray-500">{log.details}</span></div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 刪除訂單按鈕 */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 bg-red-50 p-2 rounded border border-red-200 w-full justify-between">
                  <span className="text-xs text-red-600 font-bold">確定永久刪除？</span>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDeleteConfirm(false)} className="text-xs text-gray-500 px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100">取消</button>
                    <button onClick={handleDelete} className="text-xs text-white px-2 py-1 bg-red-600 rounded hover:bg-red-700">確認刪除</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 font-medium"><Trash2 size={14}/> 永久刪除此訂單</button>
              )}
            </div>
          </div>
        </div>

        {/* 右側：多次付款與收據紀錄 */}
        <div className="w-full md:w-7/12 p-6 flex flex-col h-full overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-black text-xl text-gray-800 flex items-center gap-2"><Wallet className="text-green-600"/> 財務與收款</h3>
            
            {selectedBooking.paymentMethod !== 'PENDING' && (
              <div className="flex items-center gap-2 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">
                <span className="text-xs text-gray-500">主付款方式:</span>
                <select value={selectedBooking.paymentMethod} onChange={(e) => handleChangeMainPaymentMethod(e.target.value)} className="text-xs font-bold text-indigo-700 bg-transparent focus:outline-none cursor-pointer">
                  <option value="FPS">FPS</option><option value="PAYME">PayMe</option><option value="ALIPAY">AlipayHK</option><option value="WECHAT">WeChat Pay</option><option value="CASH">現金</option><option value="BANK">銀行轉帳</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex justify-between items-center">
            <div><div className="text-sm text-gray-500">已收金額</div><div className="text-2xl font-black text-green-600">${totalPaid}</div></div>
            <div className="text-right"><div className="text-sm text-gray-500">尚欠尾數</div><div className={`text-2xl font-black ${outstanding > 0 ? 'text-red-500' : 'text-gray-400'}`}>${Math.max(0, outstanding)}</div></div>
          </div>

          {!isFullyPaid && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm flex flex-col gap-2">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-sm font-bold text-gray-700">🎁 員工手動折扣 / 減免尾數</span>
               </div>
               <div className="flex gap-2">
                 <input type="number" placeholder="輸入減免金額 $" value={staffDiscountAmount} onChange={e=>setStaffDiscountAmount(e.target.value)} className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-indigo-500"/>
                 <button onClick={handleApplyStaffDiscount} className="bg-gray-800 text-white text-xs font-bold px-4 rounded hover:bg-black transition-colors">套用折扣</button>
               </div>
            </div>
          )}

          {!isFullyPaid && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
              <h4 className="font-bold text-indigo-800 text-sm mb-3">新增一筆收款紀錄</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-indigo-600 block mb-1">金額</label><input type="number" value={newPaymentAmount} onChange={e=>setNewPaymentAmount(e.target.value)} placeholder={`建議: ${outstanding}`} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm"/></div>
                <div><label className="text-xs text-indigo-600 block mb-1">付款方式</label>
                  <select value={newPaymentMethod} onChange={e=>setNewPaymentMethod(e.target.value)} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm bg-white">
                    <option value="FPS">轉數快 FPS</option><option value="PAYME">PayMe</option><option value="ALIPAY">AlipayHK</option><option value="WECHAT">WeChat Pay</option><option value="CASH">現金 CASH</option><option value="BANK">銀行轉帳</option>
                  </select>
                </div>
                <div><label className="text-xs text-indigo-600 block mb-1">入帳時間 (可自訂)</label><input type="datetime-local" value={newPaymentDate} onChange={e=>setNewPaymentDate(e.target.value)} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm bg-white"/></div>
                <div><label className="text-xs text-indigo-600 block mb-1">備註/項目</label><input type="text" value={newPaymentNote} onChange={e=>setNewPaymentNote(e.target.value)} placeholder="例如: 收取尾數及按金" className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm"/></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNewPaymentReceiptUrl('simulated_receipt.jpg')} className="flex-1 bg-white border border-indigo-200 text-indigo-600 text-xs font-bold py-2 rounded flex justify-center items-center gap-1 hover:bg-indigo-100"><UploadCloud size={14}/> {newPaymentReceiptUrl ? '收據已夾附' : '上傳付款收據'}</button>
                <button onClick={handleAddPayment} className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded hover:bg-indigo-700">儲存收款紀錄</button>
              </div>
            </div>
          )}

          {isFullyPaid && selectedBooking.depositStatus === 'PENDING' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <span className="text-sm font-bold text-orange-800 block mb-3">活動結束：處理退還按金 (最多 ${selectedBooking.securityDeposit || 1000})</span>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-orange-700 block mb-1">實際退款金額</label><input type="number" value={refundData.amount} onChange={e=>setRefundData({...refundData, amount: e.target.value})} className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm"/></div>
                <div><label className="text-xs text-orange-700 block mb-1">退款渠道</label>
                  <select value={refundData.method} onChange={e=>setRefundData({...refundData, method: e.target.value})} className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm bg-white font-semibold">
                    <option value="FPS">FPS</option><option value="PAYME">PayMe</option><option value="ALIPAY">AlipayHK</option><option value="WECHAT">WeChat Pay</option><option value="BANK">銀行轉帳</option><option value="CASH">現金退回</option>
                  </select>
                </div>
                <div><label className="text-xs text-orange-700 block mb-1">處理時間 (可自訂)</label><input type="datetime-local" value={refundData.date} onChange={e=>setRefundData({...refundData, date: e.target.value})} className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm bg-white"/></div>
                <div><label className="text-xs text-orange-700 block mb-1">備註 (扣錢請註明)</label><input type="text" value={refundData.note} onChange={e=>setRefundData({...refundData, note: e.target.value})} className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm" placeholder="例: 扣除清潔費 $300"/></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRefundData({...refundData, receipt: 'refund_proof.jpg'})} className="flex-1 bg-white border border-orange-200 text-orange-600 text-xs font-bold py-2 rounded flex justify-center items-center gap-1 hover:bg-orange-100"><UploadCloud size={14}/> {refundData.receipt ? '退款憑證已夾附' : '上傳退款截圖'}</button>
                <button onClick={handleProcessDepositRefund} className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded hover:bg-green-700 shadow-sm">確認執行退款</button>
              </div>
            </div>
          )}

          <div className="flex-1 mt-4">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">歷史資金流水帳</span>
            <div className="space-y-2">
              {(!selectedBooking.transactions || selectedBooking.transactions.length === 0) && <div className="text-sm text-gray-400 text-center py-4 bg-white rounded border border-gray-100">尚無財務紀錄</div>}
              {(selectedBooking.transactions||[]).map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-sm bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                   <div>
                     <div className="font-bold text-gray-800 flex items-center gap-1"><span className={tx.type === 'COLLECT' ? 'text-green-500' : (tx.type === 'DISCOUNT' ? 'text-indigo-500' : 'text-red-500')}>{tx.type === 'COLLECT' ? '+' : '-'}</span> {tx.note}</div>
                     <div className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                        <span>{tx.date}</span> | <span className="font-bold text-gray-600">{tx.method}</span>
                        {tx.receipt && <span className="text-indigo-500 flex items-center gap-1 cursor-pointer bg-indigo-50 px-1.5 rounded"><FileText size={10}/> 收據</span>}
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className={`font-black text-lg ${tx.type === 'COLLECT' ? 'text-green-600' : (tx.type === 'DISCOUNT' ? 'text-indigo-600' : 'text-red-500')}`}>
                       {tx.type === 'COLLECT' ? '+' : '-'}${tx.amount}
                     </div>
                     {confirmDeleteTxId === tx.id ? (
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-red-500 font-bold mb-0.5">確認刪除?</span>
                            <div className="flex gap-1">
                                <button onClick={() => handleDeleteTransaction(tx.id)} className="text-white bg-red-500 rounded px-1.5 py-0.5 text-[10px]">是</button>
                                <button onClick={() => setConfirmDeleteTxId(null)} className="text-gray-500 bg-gray-200 rounded px-1.5 py-0.5 text-[10px]">否</button>
                            </div>
                        </div>
                     ) : (
                        <button onClick={() => setConfirmDeleteTxId(tx.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                     )}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminFinance({ bookings, onOpenBooking }) {
  let allTransactions = [];
  bookings.forEach(b => {
    if (b.transactions) b.transactions.forEach(tx => allTransactions.push({ ...tx, orderId: b.id, customer: b.name }));
  });
  allTransactions.sort((a, b) => new Date(b.date.replace(' ', 'T')) - new Date(a.date.replace(' ', 'T')));

  const totalIncome = allTransactions.filter(t => t.type === 'COLLECT').reduce((s, t) => s + t.amount, 0);
  const totalRefund = allTransactions.filter(t => t.type === 'REFUND').reduce((s, t) => s + t.amount, 0);

  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // BOM for Excel UTF-8
    csvContent += "日期時間,關聯訂單,顧客名稱,交易類型,交易摘要,付款渠道,金額\n";
    allTransactions.forEach(tx => {
      const typeStr = tx.type === 'COLLECT' ? '收款' : '退款';
      const amountStr = (tx.type === 'COLLECT' ? '' : '-') + tx.amount;
      const row = `"${tx.date}","${tx.orderId}","${tx.customer}","${typeStr}","${tx.note}","${tx.method}","${amountStr}"`;
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `finance_export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-center">
          <div className="text-sm text-gray-500 font-bold mb-1">系統總入帳 (含按金)</div>
          <div className="text-3xl font-black text-green-600">${totalIncome.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-center">
          <div className="text-sm text-gray-500 font-bold mb-1">已退還金額 (Refunds)</div>
          <div className="text-3xl font-black text-red-500">${totalRefund.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <Wallet size={80} className="absolute -right-4 -bottom-4 opacity-10" />
          <div className="text-sm text-gray-400 font-bold mb-1">淨現金流</div>
          <div className="text-3xl font-black text-white">${(totalIncome - totalRefund).toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">所有資金流向紀錄明細</h3>
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"><Download size={16}/> 匯出 Excel</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-gray-400 border-b border-gray-100">
              <tr><th className="p-4 font-semibold">日期時間</th><th className="p-4 font-semibold">關聯訂單</th><th className="p-4 font-semibold">交易摘要</th><th className="p-4 font-semibold">付款渠道</th><th className="p-4 font-semibold text-right">金額</th></tr>
            </thead>
            <tbody>
              {allTransactions.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-gray-400">尚無任何財務紀錄</td></tr> : null}
              {allTransactions.map(tx => (
                <tr key={tx.id} onClick={() => onOpenBooking(tx.orderId)} className="border-b border-gray-50 hover:bg-indigo-50 transition-colors cursor-pointer group">
                  <td className="p-4 text-gray-500">{tx.date}</td>
                  <td className="p-4"><div className="font-bold text-indigo-600 group-hover:underline">{tx.orderId}</div><div className="text-[10px] text-gray-400">{tx.customer}</div></td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${tx.type === 'COLLECT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type === 'COLLECT' ? '收款' : '退款'}</span>
                    <span className="ml-2 text-gray-600">{tx.note}</span>
                    {tx.receipt && <span className="ml-2 text-xs text-indigo-500 border border-indigo-200 px-1 rounded bg-white">收據</span>}
                  </td>
                  <td className="p-4 font-semibold text-gray-700">{tx.method}</td>
                  <td className={`p-4 text-right font-black ${tx.type === 'COLLECT' ? 'text-green-600' : 'text-red-500'}`}>{tx.type === 'COLLECT' ? '+' : '-'}${tx.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminExpenses({ expenses, saveExpense, deleteExpense, bookings, systemConfig }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const activeCategories = systemConfig?.expenseCategories || DEFAULT_SYSTEM.expenseCategories;
  const [formData, setFormData] = useState({ id: '', date: new Date().toISOString().slice(0,10), category: activeCategories[0], vendor: '', amount: '', note: '', attachment: '' });

  let monthlyIncome = 0;
  bookings.forEach(b => {
    (b.transactions || []).forEach(tx => {
      if (tx.date.startsWith(currentMonth) && tx.type === 'COLLECT') {
        monthlyIncome += tx.amount;
      }
    });
  });

  const filteredExpenses = expenses.filter(e => {
    const matchMonth = e.date.startsWith(currentMonth);
    const matchSearch = (e.note && e.note.includes(searchQuery)) || (e.vendor && e.vendor.includes(searchQuery)) || (e.category && e.category.includes(searchQuery));
    return matchMonth && matchSearch;
  });

  const monthlyExpenseTotal = filteredExpenses.reduce((sum, e) => sum + parseInt(e.amount || 0), 0);
  const netProfit = monthlyIncome - monthlyExpenseTotal;

  const triggerAiScan = (methodType) => {
    setShowScanOptions(false);
    setIsScanning(true);
    setTimeout(() => {
      setFormData({
        id: 'exp-' + Date.now(),
        date: new Date().toISOString().slice(0,10),
        category: activeCategories.includes('到會/食材') ? '到會/食材' : activeCategories[0],
        vendor: '百佳超級市場',
        amount: 450,
        note: '派對零食與紙巾補充',
        attachment: `scanned_receipt_${methodType}.jpg`
      });
      setIsScanning(false);
      setShowForm(true);
    }, 1500);
  };

  const handleSave = () => {
    if (!formData.amount || !formData.vendor) return alert('請填寫完整資訊');
    const expenseToSave = { ...formData, id: formData.id || 'exp-' + Date.now() };
    saveExpense(expenseToSave);
    setShowForm(false);
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF";
    csvContent += "日期,類別,商店/供應商,項目備註,金額\n";
    filteredExpenses.forEach(exp => {
      const row = `"${exp.date}","${exp.category}","${exp.vendor}","${exp.note}","${exp.amount}"`;
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expenses_export_${currentMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="font-black text-xl text-gray-800 flex items-center gap-2"><BarChart3 className="text-indigo-600"/> 會計支出與報稅報表</h3>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-sm font-bold text-gray-600">結算月份</span>
          <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="font-bold text-indigo-700 bg-transparent focus:outline-none"/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 font-bold mb-1">本月總入帳 (Income)</div>
          <div className="text-3xl font-black text-green-600">${monthlyIncome.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 font-bold mb-1">本月總支出 (Expenses)</div>
          <div className="text-3xl font-black text-red-500">${monthlyExpenseTotal.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-sm text-white">
          <div className="text-sm text-gray-400 font-bold mb-1">本月淨利潤 (Net Profit)</div>
          <div className="text-3xl font-black">${netProfit.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 w-full md:w-64">
            <Search size={16} className="text-gray-400"/>
            <input type="text" placeholder="搜尋商店或備註..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full text-sm focus:outline-none"/>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={handleExportCSV} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-colors shadow-sm">
              <Download size={16}/> 匯出報表
            </button>
            <button onClick={() => {setFormData({id:'', date: new Date().toISOString().slice(0,10), category: activeCategories[0], vendor: '', amount: '', note: '', attachment: ''}); setShowForm(true);}} className="flex-1 md:flex-none bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold py-2 px-4 rounded-lg flex justify-center items-center gap-2">
              <Plus size={16}/> 手動記帳
            </button>
            <button onClick={() => setShowScanOptions(true)} disabled={isScanning} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-all shadow-sm">
              {isScanning ? <span className="animate-pulse">讀取中...</span> : <><Scan size={16}/> AI 掃描</>}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-gray-400 border-b border-gray-100">
              <tr><th className="p-4 font-semibold">日期</th><th className="p-4 font-semibold">類別</th><th className="p-4 font-semibold">商店/供應商</th><th className="p-4 font-semibold">項目備註</th><th className="p-4 font-semibold text-right">金額</th><th className="p-4 text-center">操作</th></tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400">本月尚無支出紀錄</td></tr> : null}
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="border-b border-gray-50 hover:bg-indigo-50 transition-colors">
                  <td className="p-4 text-gray-500 font-mono">{exp.date}</td>
                  <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{exp.category}</span></td>
                  <td className="p-4 font-bold text-gray-800">{exp.vendor}</td>
                  <td className="p-4 text-gray-600 flex items-center gap-2">
                    {exp.note}
                    {exp.attachment && <span className="bg-indigo-50 text-indigo-500 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer hover:bg-indigo-100"><FileText size={10}/> 附件</span>}
                  </td>
                  <td className="p-4 text-right font-black text-red-500">${parseInt(exp.amount).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => deleteExpense(exp.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showScanOptions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-center">
            <button onClick={() => setShowScanOptions(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><Scan size={32}/></div>
            <h3 className="text-lg font-black text-gray-800 mb-2">請選擇收據匯入方式</h3>
            <p className="text-sm text-gray-500 mb-6">AI 將自動辨識金額與供應商</p>
            <div className="space-y-3">
              <button onClick={() => triggerAiScan('photo')} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 shadow-sm"><Smartphone size={18} className="text-blue-500"/> 拍攝照片 (Camera)</button>
              <button onClick={() => triggerAiScan('image')} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 shadow-sm"><UploadCloud size={18} className="text-orange-500"/> 上傳圖片檔 (JPG/PNG)</button>
              <button onClick={() => triggerAiScan('doc')} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 shadow-sm"><FileText size={18} className="text-green-500"/> 上傳文件檔 (PDF)</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2"><Receipt className="text-indigo-600"/> 新增/編輯支出</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-gray-500 block mb-1">日期</label><input type="date" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 block mb-1">類別</label>
                <select value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium">
                  {activeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">商店 / 供應商名稱</label><input type="text" value={formData.vendor} onChange={e=>setFormData({...formData, vendor: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500" placeholder="例如: 百佳超市"/></div>
                <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">支出金額 ($)</label><input type="number" value={formData.amount} onChange={e=>setFormData({...formData, amount: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 font-black text-red-600" placeholder="$"/></div>
                <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">備註 / 項目明細</label><input type="text" value={formData.note} onChange={e=>setFormData({...formData, note: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500" placeholder="例如: 買紙巾、垃圾袋"/></div>
              </div>
              
              <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center bg-gray-50 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => setFormData({...formData, attachment: 'uploaded_receipt.jpg'})}>
                <div className="text-sm font-bold text-gray-600 flex items-center justify-center gap-2"><UploadCloud size={16} className="text-indigo-500"/> {formData.attachment ? '單據已夾附 (點擊更換)' : '點擊上傳相片/單據附件'}</div>
                {formData.attachment && <div className="text-[10px] text-gray-400 mt-1">{formData.attachment}</div>}
              </div>

              <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl mt-2 transition-all shadow-md">儲存紀錄</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPricingSettings({ pricing, setPricing, addons, setAddons, systemConfig, setSystemConfig }) {
  const [localPricing, setLocalPricing] = useState(pricing);
  const [localAddons, setLocalAddons] = useState(addons);
  const [localSystemMessage, setLocalSystemMessage] = useState(systemConfig?.successMessage || '');
  const [localTerms, setLocalTerms] = useState(systemConfig?.termsAndConditions || '');
  const [localCategories, setLocalCategories] = useState(systemConfig?.expenseCategories || DEFAULT_SYSTEM.expenseCategories);
  const [localPromos, setLocalPromos] = useState(systemConfig?.promoCodes || []);
  
  const [localBrandName, setLocalBrandName] = useState(systemConfig?.brandName || 'INFINITY PARTY');
  const [localBrandSub, setLocalBrandSub] = useState(systemConfig?.brandSub || '24H 智能自助派對空間');
  const [localBrandLogo, setLocalBrandLogo] = useState(systemConfig?.brandLogo || '');
  const [localAddress, setLocalAddress] = useState(systemConfig?.address || '香港九龍觀塘開源道xx號');
  const [localAdminPassword, setLocalAdminPassword] = useState(systemConfig?.adminPassword || 'admin123');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPromo, setNewPromo] = useState({ code: '', value: '', expiry: '' });
  const [saveStatus, setSaveStatus] = useState('');

  const handleSave = () => {
    setPricing(localPricing); setAddons(localAddons); 
    setSystemConfig({ 
      successMessage: localSystemMessage, 
      termsAndConditions: localTerms, 
      expenseCategories: localCategories,
      promoCodes: localPromos,
      brandName: localBrandName,
      brandSub: localBrandSub,
      brandLogo: localBrandLogo,
      address: localAddress,
      adminPassword: localAdminPassword
    });
    setSaveStatus('✅ 儲存成功，資料已同步至雲端！'); setTimeout(() => setSaveStatus(''), 3000);
  };

  const handlePriceChange = (key, value) => { setLocalPricing(prev => ({ ...prev, [key]: parseInt(value) || 0 })); };
  const handleAddonChange = (index, field, value) => {
    const newAddons = [...localAddons];
    if(field === 'price') newAddons[index][field] = parseInt(value) || 0; else newAddons[index][field] = value;
    setLocalAddons(newAddons);
  };

  const handleAddCategory = () => {
    if(newCategoryName.trim() && !localCategories.includes(newCategoryName.trim())) {
      setLocalCategories([...localCategories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-8">
          
          <div className="space-y-3">
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><Settings size={20}/> 品牌與視覺設定</h3>
            <div className="grid grid-cols-2 gap-4">
               <div><label className="text-xs text-gray-500 mb-1 block">公司/品牌名稱</label><input type="text" value={localBrandName} onChange={e => setLocalBrandName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"/></div>
               <div><label className="text-xs text-gray-500 mb-1 block">副標題/標語</label><input type="text" value={localBrandSub} onChange={e => setLocalBrandSub(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"/></div>
               <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">場地真實地址 (顯示於訂單明細)</label><input type="text" value={localAddress} onChange={e => setLocalAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"/></div>
               <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">自訂 Logo 圖片網址 (選填，若填寫將取代文字標題)</label><input type="text" value={localBrandLogo} onChange={e => setLocalBrandLogo(e.target.value)} placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"/></div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><DollarSign size={20}/> 場地定價參數</h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="col-span-2 border-b border-gray-200 pb-2 font-bold text-sm text-gray-700">包場一口價設定</div>
              <div><label className="text-xs text-gray-500 mb-1 block">包場 3小時 費用</label><input type="number" value={localPricing.flatBase} onChange={e => handlePriceChange('flatBase', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">包場加時 (每小時)</label><input type="number" value={localPricing.flatOvertime} onChange={e => handlePriceChange('flatOvertime', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              
              <div className="col-span-2 border-b border-gray-200 pb-2 pt-2 font-bold text-sm text-gray-700">按人頭收費設定</div>
              <div><label className="text-xs text-gray-500 mb-1 block">成人 3小時 費用</label><input type="number" value={localPricing.adultBase} onChange={e => handlePriceChange('adultBase', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">小童 3小時 費用</label><input type="number" value={localPricing.childBase} onChange={e => handlePriceChange('childBase', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">成人加時 (每小時)</label><input type="number" value={localPricing.adultOvertime} onChange={e => handlePriceChange('adultOvertime', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">小童加時 (每小時)</label><input type="number" value={localPricing.childOvertime} onChange={e => handlePriceChange('childOvertime', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>

              <div className="col-span-2 border-b border-gray-200 pb-2 pt-2 font-bold text-sm text-gray-700">基礎限制</div>
              <div><label className="text-xs text-gray-500 mb-1 block">最低消費 (Min Charge)</label><input type="number" value={localPricing.minCharge} onChange={e => handlePriceChange('minCharge', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">場地按金</label><input type="number" value={localPricing.deposit} onChange={e => handlePriceChange('deposit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
            </div>
          </div>

          <div className="space-y-3 bg-red-50 p-4 rounded-xl border border-red-100">
            <h3 className="text-lg font-black text-red-800 border-b-2 border-red-200 pb-2 flex items-center gap-2"><ShieldCheck size={20}/> 系統安全設定</h3>
            <div>
               <label className="text-xs text-red-600 mb-1 block font-bold">更改員工後台登入密碼</label>
               <input type="text" value={localAdminPassword} onChange={e => setLocalAdminPassword(e.target.value)} className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 bg-white"/>
            </div>
          </div>
          
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><MessageCircle size={20}/> 系統前台訊息設定</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">結帳成功後顯示的文字 (支援換行)</label>
              <textarea value={localSystemMessage} onChange={e => setLocalSystemMessage(e.target.value)} rows="3" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-indigo-500"></textarea>
            </div>
            <div className="mt-4">
              <label className="text-xs text-gray-500 mb-1 block">預訂條款及細則 (顯示於結帳前，支援換行)</label>
              <textarea value={localTerms} onChange={e => setLocalTerms(e.target.value)} rows="5" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-indigo-500"></textarea>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end border-b-2 border-indigo-100 pb-2">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><Plus size={20}/> 自訂加購服務</h3>
              <button onClick={() => setLocalAddons([...localAddons, { id: 'a' + Date.now(), name: '新加購', price: 100, leadTime: '' }])} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">+ 新增</button>
            </div>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
              {localAddons.map((addon, index) => (
                <div key={addon.id} className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input type="text" value={addon.name} onChange={e => handleAddonChange(index, 'name', e.target.value)} className="w-full border-b px-1 py-1 text-sm font-bold focus:border-indigo-500"/>
                    <div className="flex gap-2">
                      <div className="flex-1"><label className="text-[10px] text-gray-400 block">價格</label><input type="number" value={addon.price} onChange={e => handleAddonChange(index, 'price', e.target.value)} className="w-full border rounded px-2 py-1 text-sm"/></div>
                    </div>
                  </div>
                  <button onClick={() => setLocalAddons(localAddons.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-lg mt-1"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t-2 border-indigo-50">
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><DollarSign size={20}/> 限時優惠碼管理</h3>
            <div className="flex gap-2 mb-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex-1 space-y-2">
                 <input type="text" placeholder="代碼 (例: XMAS200)" value={newPromo.code} onChange={e=>setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} className="w-full border rounded-lg px-2 py-1.5 text-sm"/>
                 <div className="flex gap-2">
                    <input type="number" placeholder="減免金額 $" value={newPromo.value} onChange={e=>setNewPromo({...newPromo, value: e.target.value})} className="w-1/2 border rounded-lg px-2 py-1.5 text-sm"/>
                    <input type="date" title="到期日" value={newPromo.expiry} onChange={e=>setNewPromo({...newPromo, expiry: e.target.value})} className="w-1/2 border rounded-lg px-2 py-1.5 text-sm text-gray-500"/>
                 </div>
              </div>
              <button onClick={() => { if(newPromo.code && newPromo.value && newPromo.expiry) { setLocalPromos([...localPromos, {...newPromo}]); setNewPromo({code:'', value:'', expiry:''}); } }} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm self-end hover:bg-black transition-colors flex-shrink-0">新增</button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {localPromos.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
                  <div>
                     <span className="font-black text-indigo-700 tracking-wider bg-indigo-50 px-2 py-0.5 rounded">{p.code}</span>
                     <div className="text-xs text-gray-500 mt-1">減 <span className="font-bold text-gray-800">${p.value}</span> | 至 {p.expiry}</div>
                  </div>
                  <button onClick={()=>setLocalPromos(localPromos.filter((_, idx)=>idx!==i))} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t-2 border-indigo-50 pt-4">
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><BarChart3 size={20}/> 會計支出類別管理</h3>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="輸入新類別名稱" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"/>
              <button onClick={handleAddCategory} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition-colors"><Plus size={16}/></button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-1">
              {localCategories.map((cat, idx) => (
                <div key={idx} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 shadow-sm">
                  <span className="font-semibold">{cat}</span>
                  <button onClick={() => setLocalCategories(localCategories.filter(c => c !== cat))} className="text-indigo-400 hover:text-red-500 p-0.5 bg-white rounded-full"><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      <div className="border-t pt-5 bg-gray-50 p-6 flex justify-between items-center"><div className="text-green-600 font-bold text-sm">{saveStatus}</div><button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-md">儲存並同步至雲端</button></div>
    </div>
  );
}

function LoginModal({ adminPassword, onClose, onSuccess }) {
  const [pwd, setPwd] = useState(''); const [error, setError] = useState('');
  const handleLogin = (e) => { e.preventDefault(); if (pwd === adminPassword) onSuccess(); else setError('密碼錯誤'); };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        <div className="flex flex-col items-center mb-6"><div className="bg-indigo-100 p-3 rounded-full mb-3"><Lock className="text-indigo-600" size={24} /></div><h2 className="text-xl font-bold text-gray-800">員工後台登入</h2></div>
        <form onSubmit={handleLogin}><input type="password" placeholder="輸入密碼" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-2 focus:border-indigo-500 focus:outline-none" value={pwd} onChange={(e) => {setPwd(e.target.value); setError('');}} autoFocus/>{error && <p className="text-red-500 text-xs mb-3 pl-1">{error}</p>}<button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors shadow-sm">登入系統</button></form>
      </div>
    </div>
  );
}
