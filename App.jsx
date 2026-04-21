import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Users, Clock, DollarSign, MessageCircle, 
  CheckCircle, ShieldCheck, User, Baby, Plus, Minus,
  Lock, X, LayoutDashboard, Sun, Moon, Sunrise, ChevronLeft, ChevronRight, 
  Settings, Phone, HelpCircle, Trash2, Link,
  UploadCloud, FileText, Wallet, Cloud, Calculator,
  Receipt, BarChart3, Scan, Search, Smartphone,
  Smile, Heart, Tent, Image as ImageIcon
} from 'lucide-react';

// --- Firebase 雲端資料庫模組 (加入防護機制) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// 安全地解析 Firebase 設定，避免因設定遺失導致全站崩潰
let fConfig = { apiKey: "dummy", projectId: "dummy", appId: "dummy" };
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

// --- 初始預設數據 ---
const DEFAULT_PRICING = { minCharge: 2000, adultBase: 188, adultOvertime: 40, childBase: 94, childOvertime: 20, flatBase: 3880, flatOvertime: 1000, deposit: 1000 };
const DEFAULT_ADDONS = [
  { id: 'a1', name: '🍕 豪華到會派對套餐', price: 800, leadTime: '需提前48小時' },
  { id: 'a2', name: '🎈 專人生日氣球佈置', price: 500, leadTime: '需提前24小時' },
];
const DEFAULT_SYSTEM = { 
  companyName: 'INFINITY',
  subtitle: 'PARTY SPACE',
  logoUrl: '',
  venueAddress: '香港九龍觀塘開源道xx號',
  successMessage: '感謝您的預約。\n請支付【訂金】以保留檔期。\n我們已透過 WhatsApp 發送確認信及付款指引，請將付款截圖回傳給我們。',
  termsAndConditions: '1 - 人數一經確定，可加不可減\n2 - 除非不可抗力因素，如八號風球，否則不設改期或退款\n3 - 請預留時間收拾還原場地，如太多垃圾或混亂，會收取清潔費$300 起',
  expenseCategories: ['日常耗材', '到會/食材', '清潔費', '水電煤網', '維修保養', '行銷廣告', '退款/賠償', '其他']
};

export default function InfinityPartyApp() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('BOOKING'); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  
  // --- 雲端同步狀態 ---
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [addonsConfig, setAddonsConfig] = useState(DEFAULT_ADDONS);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING);
  const [systemConfig, setSystemConfig] = useState(DEFAULT_SYSTEM);
  const [isCloudSyncing, setIsCloudSyncing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Auth error:", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(bookingsRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setBookings(data);
    }, (err) => console.error("Bookings sync error:", err)); // 修復 Illegal Invocation

    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setExpenses(data);
    }, (err) => console.error("Expenses sync error:", err));

    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'settings');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      snap.docs.forEach(doc => {
        if (doc.id === 'pricing') setPricingConfig({ ...DEFAULT_PRICING, ...doc.data() });
        if (doc.id === 'addons') setAddonsConfig(doc.data().items || DEFAULT_ADDONS);
        if (doc.id === 'system') setSystemConfig({ ...DEFAULT_SYSTEM, ...doc.data() });
      });
      setIsCloudSyncing(false);
    }, (err) => console.error("Settings sync error:", err));

    return () => { unsubBookings(); unsubExpenses(); unsubSettings(); };
  }, [user]);

  const saveConfigToCloud = async (collectionName, dataObj) => {
    if (!user) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', collectionName), dataObj); } 
    catch (e) { console.error("Save config error:", e); }
  };

  const updateBookingInCloud = async (id, updates) => {
    if (!user) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), updates); } 
    catch (e) { console.error("Update booking error:", e); }
  };

  const saveExpenseToCloud = async (expense) => {
    if (!user) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expense.id), expense); }
    catch (e) { console.error("Save expense error:", e); }
  };

  const deleteExpenseFromCloud = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id)); }
    catch (e) { console.error("Delete expense error:", e); }
  };

  const getBookedSlotsMap = () => {
    const map = {};
    bookings.forEach(b => {
      if (!map[b.date]) map[b.date] = [];
      if (!map[b.date].includes(b.session)) map[b.date].push(b.session);
    });
    return map;
  };

  const handleCheckoutSuccess = async (newOrder) => {
    if (!user) return;
    try {
      const orderToSave = { ...newOrder, createdAt: new Date().toISOString() };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', newOrder.id), orderToSave);
      setLastOrder(orderToSave);

      // 模擬觸發 Webhook，發送 WhatsApp 給 65778641
      console.log(`[系統通知] 正在發送 WhatsApp API 訊息至 65778641... 訂單: ${newOrder.id}`);

      setCurrentView('SUCCESS');
      window.scrollTo(0, 0);
    } catch (e) {
      console.error("Create order error:", e);
      alert("預約提交失敗，請稍後再試");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-10 flex flex-col">
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-40">
        <div className="font-bold text-lg tracking-wider cursor-pointer flex items-center gap-2" onClick={() => setCurrentView('BOOKING')}>
          {systemConfig?.logoUrl ? <img src={systemConfig.logoUrl} alt="logo" className="h-6 object-contain rounded"/> : <Baby size={20} className="text-pink-300"/>}
          {systemConfig?.companyName || 'INFINITY PARTY'}
        </div>
        <div className="flex items-center gap-4">
          {!isCloudSyncing && <div className="hidden md:flex items-center gap-1 text-xs text-green-400 bg-gray-800 px-2 py-1 rounded"><Cloud size={14}/> 雲端同步中</div>}
          {isAuthenticated ? (
            <button onClick={() => {setIsAuthenticated(false); setCurrentView('BOOKING');}} className="bg-gray-800 text-gray-300 px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-gray-700 transition-colors">返回前台</button>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800"><Lock size={18} /></button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {currentView === 'BOOKING' && (
          <CustomerBookingFlow pricing={pricingConfig} addons={addonsConfig} systemConfig={systemConfig} bookedData={getBookedSlotsMap()} onCheckout={handleCheckoutSuccess} />
        )}
        {currentView === 'SUCCESS' && (
          <SuccessPage order={lastOrder} systemConfig={systemConfig} pricing={pricingConfig} onBackHome={() => setCurrentView('BOOKING')} />
        )}
        {currentView === 'ADMIN' && (
          <AdminDashboard 
            pricing={pricingConfig} setPricing={(cfg) => saveConfigToCloud('pricing', cfg)}
            addons={addonsConfig} setAddons={(items) => saveConfigToCloud('addons', {items})}
            systemConfig={systemConfig} setSystemConfig={(cfg) => saveConfigToCloud('system', cfg)}
            bookings={bookings} updateBooking={updateBookingInCloud} bookedData={getBookedSlotsMap()}
            expenses={expenses} saveExpense={saveExpenseToCloud} deleteExpense={deleteExpenseFromCloud}
          />
        )}
      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={() => {setIsAuthenticated(true); setCurrentView('ADMIN'); setShowLoginModal(false);}} />}
    </div>
  );
}

// ==========================================
// 🧑‍💻 客戶端：預約流程
// ==========================================
function CustomerBookingFlow({ pricing, addons, systemConfig, bookedData, onCheckout }) {
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

  const baseHours = 3; 
  const bookedSlotsForDate = selectedDate ? (bookedData[selectedDate] || []) : [];
  useEffect(() => { setOvertimeHours(0); }, [sessionType, selectedDate]);

  // 使用安全預設值防止定價計算時出現 NaN
  const safePricing = { ...DEFAULT_PRICING, ...pricing };
  
  const overtimeCostByHeadcount = (adults * safePricing.adultOvertime + children * safePricing.childOvertime) * overtimeHours;
  const rawBaseOnlyTotal = (adults * safePricing.adultBase) + (children * safePricing.childBase);
  const effectiveBasePrice = Math.max(rawBaseOnlyTotal, safePricing.minCharge);
  const perPersonGrandTotal = effectiveBasePrice + overtimeCostByHeadcount;
  const flatRateGrandTotal = safePricing.flatBase + (overtimeHours * safePricing.flatOvertime);

  const isFlatRate = perPersonGrandTotal >= flatRateGrandTotal;
  const finalRoomPrice = isFlatRate ? flatRateGrandTotal : perPersonGrandTotal;

  const addonsPrice = selectedAddons.reduce((sum, id) => {
    const addon = (addons || []).find(a => a.id === id);
    return sum + (addon ? parseInt(addon.price) || 0 : 0);
  }, 0);
  
  const finalTotalPrice = finalRoomPrice + addonsPrice; 
  const depositAmount = finalTotalPrice / 2; 
  const balanceAmount = finalTotalPrice - depositAmount; 
  const securityDeposit = safePricing.deposit; 

  const isValidPhone = /^[0-9]{8}$/.test(customerPhone);
  const isReadyToCheckout = selectedDate !== '' && sessionType !== '' && customerName.trim() !== '' && isValidPhone && agreeTerms;

  const handleProcessCheckout = () => {
    const orderId = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);
    const newOrder = {
      id: orderId, date: selectedDate, session: sessionType,
      name: customerName, phone: customerPhone, source: customerSource || '未填寫',
      adults, children, overtimeHours, isFlatRate, 
      totalRoomAndAddons: finalTotalPrice,
      depositAmount, balanceAmount, securityDeposit,
      addons: selectedAddons,
      status: 'PENDING', depositStatus: 'PENDING', paymentMethod: 'PENDING', receipt: null, transactions: []
    };
    onCheckout(newOrder);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden pb-36 border border-gray-100">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-white text-center relative overflow-hidden">
        <Smile className="absolute top-4 left-4 text-white/20" size={60} strokeWidth={1.5} />
        <Tent className="absolute -bottom-4 -right-4 text-white/20" size={100} strokeWidth={1} />
        <Heart className="absolute top-10 right-8 text-pink-300/50 fill-current" size={30} />
        
        <div className="relative z-10">
          {systemConfig?.logoUrl ? (
            <img src={systemConfig.logoUrl} alt="Logo" className="h-20 mx-auto mb-3 object-contain drop-shadow-lg rounded-xl" />
          ) : (
            <>
              <h1 className="text-3xl font-black tracking-widest mb-1 drop-shadow-md">{systemConfig?.companyName || 'INFINITY'}</h1>
              <p className="text-indigo-100 font-bold tracking-[0.2em] text-sm mb-4 drop-shadow-sm">{systemConfig?.subtitle || 'PARTY SPACE'}</p>
            </>
          )}
          <div className="inline-flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2 rounded-full text-xs font-bold shadow-sm border border-white/30 mt-2">
            <Baby size={18} className="text-pink-200" /> 溫馨親子派對空間 <Heart size={16} className="text-red-300 fill-current" />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-800 font-bold mb-4 border-b pb-2"><CalendarIcon className="text-indigo-600" size={20} /><span>選擇日期</span></div>
          <MiniCalendar selectedDate={selectedDate} onSelectDate={(date) => { setSelectedDate(date); setSessionType(''); }} bookedData={bookedData} />
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all ${selectedDate ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-50 pointer-events-none'}`}>
          <div className="flex items-center gap-2 text-gray-800 font-bold mb-4 border-b pb-2"><Clock className="text-indigo-600" size={20} /><span>選擇時段</span></div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <SessionButton type="MORNING" label="早上" time="10:00 - 13:00" icon={Sunrise} colorClass="amber-500" currentSelection={sessionType} onSelect={setSessionType} bookedSlots={bookedSlotsForDate} />
            <SessionButton type="AFTERNOON" label="下午" time="14:00 - 17:00" icon={Sun} colorClass="orange-500" currentSelection={sessionType} onSelect={setSessionType} bookedSlots={bookedSlotsForDate} />
            <SessionButton type="NIGHT" label="夜晚" time="18:00 - 21:00" icon={Moon} colorClass="indigo-500" currentSelection={sessionType} onSelect={setSessionType} bookedSlots={bookedSlotsForDate} />
          </div>
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
            <div><div className="text-gray-800 font-medium text-sm">延長時間 <span className="text-[11px] text-gray-500">(基本{baseHours}hr)</span></div></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOvertimeHours(Math.max(0, overtimeHours - 1))} className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600"><Minus size={16}/></button>
              <span className="font-bold w-4 text-center">{overtimeHours}</span>
              <button onClick={() => setOvertimeHours(overtimeHours + 1)} className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600"><Plus size={16}/></button>
            </div>
          </div>
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all ${sessionType ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-50 pointer-events-none'}`}>
           <div className="flex items-center gap-2 text-gray-800 mb-4 font-bold border-b pb-2"><Users className="text-indigo-600" size={20} /><span>派對人數</span></div>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-end mb-2"><div className="flex items-center gap-2 text-sm font-semibold text-gray-700"><User size={16} className="text-gray-400"/> 成人</div><span className="text-lg font-black text-gray-800">{adults}</span></div>
              <input type="range" min="1" max="30" value={adults} onChange={(e) => setAdults(parseInt(e.target.value))} className="w-full accent-indigo-600" />
            </div>
            <div>
              <div className="flex justify-between items-end mb-2"><div className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Baby size={16} className="text-gray-400"/> 小童 <span className="text-[10px] text-gray-400">(1-10歲)</span></div><span className="text-lg font-black text-gray-800">{children}</span></div>
              <input type="range" min="0" max="15" value={children} onChange={(e) => setChildren(parseInt(e.target.value))} className="w-full accent-indigo-600" />
            </div>
          </div>
          <div className={`mt-5 p-4 rounded-xl border-2 transition-all duration-300 ${isFlatRate ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-start mb-1"><div className="text-gray-700 font-bold text-sm mt-1">場租小計</div><div className="font-black text-2xl text-indigo-700">${finalRoomPrice}</div></div>
          </div>
        </div>

        <div className={`transition-all ${sessionType ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 border-b pb-2"><DollarSign size={18} className="text-indigo-600" /> 加購升級服務</h3>
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

        <div className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all ${sessionType ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2"><User size={18} className="text-indigo-600" /> 聯絡資料填寫</h3>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-600 mb-1">顧客名稱 *</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="例如: 陳大文" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"/></div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">聯絡電話 (WhatsApp) *</label>
              <div className="flex">
                <span className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg px-3 py-2 text-sm text-gray-500">+852</span>
                <input 
                  type="tel" 
                  value={customerPhone} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setCustomerPhone(val);
                  }} 
                  placeholder="例如: 98765432" 
                  className={`w-full border rounded-r-lg px-3 py-2 text-sm focus:outline-none ${customerPhone && customerPhone.length < 8 ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-gray-300 focus:border-indigo-500'}`}
                />
              </div>
              {customerPhone && customerPhone.length < 8 && <div className="text-[10px] text-red-500 mt-1 font-semibold">請輸入完整的 8 位數字香港電話號碼</div>}
            </div>
          </div>
        </div>

        <div className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all ${sessionType ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2"><FileText size={18} className="text-indigo-600" /> 預訂條款與細則</h3>
          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 mb-4 whitespace-pre-line leading-relaxed">
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
            <div>訂單總額 (不含按金): <span className="font-bold">${finalTotalPrice}</span></div>
            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1"><ShieldCheck size={14}/> 另加按金 ${securityDeposit}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">第一期：現在付款 (訂金)</div>
            <div className="text-2xl font-black text-indigo-700 leading-none">${depositAmount}</div>
          </div>
        </div>
        <div className="bg-gray-50 text-xs text-gray-500 p-2 rounded mb-3 flex items-start gap-1">
          <Clock size={14} className="mt-0.5 text-gray-400 flex-shrink-0"/>
          <span>第二期尾數 (${balanceAmount}) + 按金 (${securityDeposit})，將於活動前一天付款。</span>
        </div>
        <button disabled={!isReadyToCheckout} onClick={handleProcessCheckout} className={`w-full font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg transition-all ${isReadyToCheckout ? 'bg-gray-900 hover:bg-black text-white active:scale-95' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
          {isReadyToCheckout ? '確認送出並繳付訂金' : '請填寫完整預約資料並同意條款'}
        </button>
      </div>
    </div>
  );
}

function SuccessPage({ order, systemConfig, pricing, onBackHome }) {
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
        <div className="flex justify-between mb-1"><span className="text-gray-500">場地地址</span><span className="font-bold text-gray-800 text-right">{systemConfig?.venueAddress || '未設定地址'}</span></div>
      </div>
      
      <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-xl mb-6 flex items-start gap-2 text-left shadow-sm">
        <Smartphone size={16} className="mt-0.5 flex-shrink-0" />
        <span>系統已自動發送新預約 WhatsApp 通知至管理員專線 (65778641)。</span>
      </div>

      <button onClick={onBackHome} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95">返回首頁</button>
    </div>
  );
}

// ==========================================
// 👑 老闆管理後台
// ==========================================
function AdminDashboard({ pricing, setPricing, addons, setAddons, systemConfig, setSystemConfig, bookings, updateBooking, bookedData, expenses, saveExpense, deleteExpense }) {
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
          addonsConfig={addons} 
        />
      )}
    </div>
  );
}

// --- 日曆管理面板 ---
function AdminBookingCalendar({ bookings, bookedData, setSelectedBooking }) {
  const [adminSelectedDate, setAdminSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [viewMode, setViewMode] = useState('DAILY'); // 'DAILY' 或 'UPCOMING'
  const [searchQuery, setSearchQuery] = useState(''); // 新增搜尋狀態
  const todayString = new Date().toISOString().slice(0,10);

  const dailyBookings = bookings.filter(b => b.date === adminSelectedDate);
  const upcomingBookings = bookings
    .filter(b => b.date >= todayString)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const sessionOrder = { MORNING: 1, AFTERNOON: 2, NIGHT: 3 };
      return (sessionOrder[a.session] || 0) - (sessionOrder[b.session] || 0);
    });

  const getSessionLabel = (s) => s === 'MORNING' ? '🌅 早上' : s === 'AFTERNOON' ? '☀️ 下午' : '🌙 夜晚';
  
  // 智能搜尋與顯示邏輯
  let displayBookings = viewMode === 'DAILY' ? dailyBookings : upcomingBookings;
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase().trim();
    displayBookings = bookings.filter(b => 
      (b.name && b.name.toLowerCase().includes(query)) ||
      (b.phone && b.phone.includes(query)) ||
      (b.date && b.date.includes(query)) ||
      (b.id && b.id.toLowerCase().includes(query))
    ).sort((a, b) => new Date(b.date) - new Date(a.date)); // 搜尋模式下按日期排序
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-fit">
        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">選擇日期查看排程</h3>
        <MiniCalendar selectedDate={adminSelectedDate} onSelectDate={(date) => { setAdminSelectedDate(date); setViewMode('DAILY'); setSearchQuery(''); }} bookedData={bookedData} />
      </div>

      <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 min-h-[400px]">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 border-b pb-3 gap-3">
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button onClick={() => {setViewMode('DAILY'); setSearchQuery('');}} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'DAILY' && !searchQuery ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📅 {adminSelectedDate} 檢視</button>
              <button onClick={() => {setViewMode('UPCOMING'); setSearchQuery('');}} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'UPCOMING' && !searchQuery ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🚀 未來列表</button>
            </div>
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="搜尋姓名、電話或日期..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
          </div>
          <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full whitespace-nowrap">共 {displayBookings.length} 張訂單</span>
        </div>
        
        {displayBookings.length === 0 ? (
          <div className="text-center py-16 text-gray-400 flex flex-col items-center">
            <CalendarIcon size={48} className="mb-2 opacity-50"/>
            <p>{searchQuery ? '找不到符合條件的預約' : (viewMode === 'DAILY' ? '該日目前無任何預約' : '目前尚無未來的預約')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayBookings.map(b => {
              const totalRequired = (b.totalRoomAndAddons || 0) + (b.securityDeposit || 1000);
              const totalPaid = (b.transactions||[]).filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0);
              const isFullyPaid = totalPaid >= totalRequired;

              return (
                <div key={b.id} onClick={() => setSelectedBooking(b)} className="border border-gray-100 bg-gray-50 hover:bg-indigo-50 rounded-xl p-4 cursor-pointer flex justify-between items-center relative overflow-hidden transition-colors">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isFullyPaid ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                  <div className="pl-2">
                    <div className="flex items-center gap-2 mb-1">
                      {viewMode === 'UPCOMING' && <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded tracking-wider">{b.date}</span>}
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

// --- 預約詳情與財務大視窗 ---
function AdminBookingDetailModal({ selectedBooking, setSelectedBooking, updateBooking, addonsConfig }) {
  const getSessionLabel = (s) => s === 'MORNING' ? '🌅 早上' : s === 'AFTERNOON' ? '☀️ 下午' : '🌙 夜晚';
  
  const totalRequired = (selectedBooking.totalRoomAndAddons || 0) + (selectedBooking.securityDeposit || 1000);
  const totalPaid = (selectedBooking.transactions||[]).filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0);
  const outstanding = totalRequired - totalPaid;
  const isFullyPaid = outstanding <= 0;

  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('FPS');
  const [newPaymentNote, setNewPaymentNote] = useState('繳付訂金');
  const [newPaymentReceiptUrl, setNewPaymentReceiptUrl] = useState('');

  const [refundData, setRefundData] = useState({ 
    amount: selectedBooking.securityDeposit || 1000, 
    method: 'FPS', 
    receipt: '', 
    note: '退還按金' 
  });

  const handleAddPayment = () => {
    if(!newPaymentAmount || isNaN(newPaymentAmount)) return alert("請輸入正確金額");
    const newTx = {
      id: 'tx-' + Date.now(), date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      type: 'COLLECT', amount: parseInt(newPaymentAmount), method: newPaymentMethod, note: newPaymentNote, receipt: newPaymentReceiptUrl || null
    };
    const updatedTransactions = [...(selectedBooking.transactions || []), newTx];
    const newStatus = (updatedTransactions.filter(t => t.type==='COLLECT').reduce((s,t)=>s+t.amount, 0)) >= totalRequired ? 'CONFIRMED' : 'PARTIAL_PAID';
    
    let pMethod = selectedBooking.paymentMethod;
    if (pMethod === 'PENDING') pMethod = newPaymentMethod;

    const updates = { transactions: updatedTransactions, status: newStatus, paymentMethod: pMethod };
    updateBooking(selectedBooking.id, updates);
    setSelectedBooking({ ...selectedBooking, ...updates });
    setNewPaymentAmount(''); setNewPaymentReceiptUrl('');
  };

  const handleProcessDepositRefund = () => {
    if(refundData.amount < 0) return;
    const newTx = {
      id: 'tx-' + Date.now(), date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      type: 'REFUND', amount: parseInt(refundData.amount), method: refundData.method, note: refundData.note, receipt: refundData.receipt || null
    };
    const isFullRefund = parseInt(refundData.amount) === (selectedBooking.securityDeposit || 1000);
    const updates = { depositStatus: isFullRefund ? 'REFUNDED' : 'DEDUCTED', transactions: [...(selectedBooking.transactions||[]), newTx] };
    updateBooking(selectedBooking.id, updates);
    setSelectedBooking({ ...selectedBooking, ...updates });
  };

  const handleChangeMainPaymentMethod = (newMethod) => {
    updateBooking(selectedBooking.id, { paymentMethod: newMethod });
    setSelectedBooking({ ...selectedBooking, paymentMethod: newMethod });
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
            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500 text-sm">日期時段</span><span className="font-bold text-right text-sm">{selectedBooking.date} {getSessionLabel(selectedBooking.session)}</span></div>
            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500 text-sm">顧客資料</span><span className="font-bold text-right text-sm">{selectedBooking.name} ({selectedBooking.phone})</span></div>
            
            <div>
              <span className="text-gray-500 text-sm block mb-2 flex items-center gap-1"><Calculator size={14}/> 預約與計價參數</span>
              <div className="text-sm bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <div className="font-bold text-indigo-800 mb-2 border-b border-indigo-200 pb-1">
                    計價方式: {selectedBooking.isFlatRate ? '包場一口價' : '按人頭收費'}
                  </div>
                  <div className="flex justify-between text-gray-700 mb-1">
                      <span>派對人數</span>
                      <span className="font-semibold">大人 {selectedBooking.adults || 0} | 小童 {selectedBooking.children || 0}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                      <span>加時時數</span>
                      <span className="font-semibold">{selectedBooking.overtimeHours || 0} 小時</span>
                  </div>
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
                <div className="flex justify-between"><span>場租 + 加購</span><span>${selectedBooking.totalRoomAndAddons || 0}</span></div>
                <div className="flex justify-between text-orange-600"><span>場地按金</span><span>${selectedBooking.securityDeposit || 1000}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-gray-200 mt-2"><span>應收總額</span><span className="text-lg text-indigo-700">${totalRequired}</span></div>
              </div>
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
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
              <h4 className="font-bold text-indigo-800 text-sm mb-3">新增一筆收款紀錄</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-indigo-600 block mb-1">金額</label><input type="number" value={newPaymentAmount} onChange={e=>setNewPaymentAmount(e.target.value)} placeholder={`建議: ${outstanding}`} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm"/></div>
                <div><label className="text-xs text-indigo-600 block mb-1">付款方式</label>
                  <select value={newPaymentMethod} onChange={e=>setNewPaymentMethod(e.target.value)} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm bg-white">
                    <option value="FPS">轉數快 FPS</option><option value="PAYME">PayMe</option><option value="ALIPAY">AlipayHK</option><option value="WECHAT">WeChat Pay</option><option value="CASH">現金 CASH</option><option value="BANK">銀行轉帳</option>
                  </select>
                </div>
                <div className="col-span-2"><label className="text-xs text-indigo-600 block mb-1">備註/項目</label><input type="text" value={newPaymentNote} onChange={e=>setNewPaymentNote(e.target.value)} placeholder="例如: 收取尾數及按金" className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm"/></div>
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
                <div className="col-span-2"><label className="text-xs text-orange-700 block mb-1">備註 (若有扣錢請註明原因)</label><input type="text" value={refundData.note} onChange={e=>setRefundData({...refundData, note: e.target.value})} className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm" placeholder="例如: 扣除清潔費 $300"/></div>
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
                     <div className="font-bold text-gray-800 flex items-center gap-1"><span className={tx.type === 'COLLECT' ? 'text-green-500' : 'text-red-500'}>{tx.type === 'COLLECT' ? '+' : '-'}</span> {tx.note}</div>
                     <div className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                        <span>{tx.date}</span> | <span className="font-bold text-gray-600">{tx.method}</span>
                        {tx.receipt && <span className="text-indigo-500 flex items-center gap-1 cursor-pointer bg-indigo-50 px-1.5 rounded"><FileText size={10}/> 收據</span>}
                     </div>
                   </div>
                   <div className={`font-black text-lg ${tx.type === 'COLLECT' ? 'text-green-600' : 'text-red-500'}`}>
                     {tx.type === 'COLLECT' ? '+' : '-'}${tx.amount}
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

// --- 資金流管理 ---
function AdminFinance({ bookings, onOpenBooking }) {
  let allTransactions = [];
  bookings.forEach(b => {
    if (b.transactions) b.transactions.forEach(tx => allTransactions.push({ ...tx, orderId: b.id, customer: b.name }));
  });
  allTransactions.sort((a, b) => new Date(b.date.replace(' ', 'T')) - new Date(a.date.replace(' ', 'T')));

  const totalIncome = allTransactions.filter(t => t.type === 'COLLECT').reduce((s, t) => s + t.amount, 0);
  const totalRefund = allTransactions.filter(t => t.type === 'REFUND').reduce((s, t) => s + t.amount, 0);

  const exportFinanceCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF 確保 Excel 讀取中文不亂碼
    csvContent += "日期時間,關聯訂單,客戶,交易摘要,付款渠道,類型,金額\n";
    allTransactions.forEach(tx => {
      const row = [
        `"${tx.date}"`,
        `"${tx.orderId}"`,
        `"${tx.customer || ''}"`,
        `"${tx.note || ''}"`,
        `"${tx.method}"`,
        `"${tx.type === 'COLLECT' ? '收款' : '退款'}"`,
        `"${tx.type === 'COLLECT' ? '+' : '-'}${tx.amount}"`
      ].join(",");
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finance_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center gap-4">
          <h3 className="font-bold text-gray-800">所有資金流向紀錄明細 (點擊以查看訂單)</h3>
          <button onClick={exportFinanceCSV} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-bold py-1.5 px-3 rounded-lg flex items-center gap-2 shadow-sm whitespace-nowrap">
            <FileText size={16}/> 匯出 Excel
          </button>
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

// --- AI 支出管理與報稅模組 ---
function AdminExpenses({ expenses, saveExpense, deleteExpense, bookings, systemConfig }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [formData, setFormData] = useState({ id: '', date: new Date().toISOString().slice(0,10), category: '', vendor: '', amount: '', note: '', attachment: '' });
  const activeCategories = systemConfig?.expenseCategories || DEFAULT_SYSTEM.expenseCategories;

  // 計算該月份營收
  let monthlyIncome = 0;
  bookings.forEach(b => {
    (b.transactions || []).forEach(tx => {
      if (tx.date.startsWith(currentMonth) && tx.type === 'COLLECT') {
        monthlyIncome += tx.amount;
      }
    });
  });

  // 篩選與計算該月份支出
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

  const exportExpensesCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF 確保 Excel 讀取中文不亂碼
    csvContent += "日期,類別,商店/供應商,項目備註,金額\n";
    filteredExpenses.forEach(exp => {
      const row = [
        `"${exp.date}"`,
        `"${exp.category}"`,
        `"${exp.vendor}"`,
        `"${exp.note || ''}"`,
        `"${exp.amount}"`
      ].join(",");
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_report_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button onClick={exportExpensesCSV} className="flex-1 md:flex-none bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-bold py-2 px-4 rounded-lg flex justify-center items-center gap-2 shadow-sm">
              <FileText size={16}/> 匯出 Excel
            </button>
            <button onClick={() => {setFormData({id:'', date: new Date().toISOString().slice(0,10), category: activeCategories[0], vendor: '', amount: '', note: '', attachment: ''}); setShowForm(true);}} className="flex-1 md:flex-none bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold py-2 px-4 rounded-lg flex justify-center items-center gap-2">
              <Plus size={16}/> 手動記帳
            </button>
            <button onClick={() => setShowScanOptions(true)} disabled={isScanning} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-all shadow-sm">
              {isScanning ? <span className="animate-pulse">讀取中...</span> : <><Scan size={16}/> AI 掃描單據</>}
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

      {}
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

      {}
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

// --- 營運設定管理 ---
function AdminPricingSettings({ pricing, setPricing, addons, setAddons, systemConfig, setSystemConfig }) {
  const [localPricing, setLocalPricing] = useState(pricing);
  const [localAddons, setLocalAddons] = useState(addons);
  const [localCompanyName, setLocalCompanyName] = useState(systemConfig?.companyName || DEFAULT_SYSTEM.companyName);
  const [localSubtitle, setLocalSubtitle] = useState(systemConfig?.subtitle || DEFAULT_SYSTEM.subtitle);
  const [localLogoUrl, setLocalLogoUrl] = useState(systemConfig?.logoUrl || DEFAULT_SYSTEM.logoUrl);
  const [localVenueAddress, setLocalVenueAddress] = useState(systemConfig?.venueAddress || DEFAULT_SYSTEM.venueAddress || '');
  const [localSystemMessage, setLocalSystemMessage] = useState(systemConfig?.successMessage || '');
  const [localTerms, setLocalTerms] = useState(systemConfig?.termsAndConditions || '');
  const [localCategories, setLocalCategories] = useState(systemConfig?.expenseCategories || DEFAULT_SYSTEM.expenseCategories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const handleSave = () => {
    setPricing(localPricing); setAddons(localAddons); 
    setSystemConfig({ 
      companyName: localCompanyName, subtitle: localSubtitle, logoUrl: localLogoUrl, venueAddress: localVenueAddress,
      successMessage: localSystemMessage, termsAndConditions: localTerms, expenseCategories: localCategories 
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
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><ImageIcon size={20}/> 品牌與視覺設定</h3>
            <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <div><label className="text-xs text-gray-600 mb-1 block font-bold">公司名稱</label><input type="text" value={localCompanyName} onChange={e => setLocalCompanyName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500" placeholder="例如: INFINITY"/></div>
              <div><label className="text-xs text-gray-600 mb-1 block font-bold">副標題</label><input type="text" value={localSubtitle} onChange={e => setLocalSubtitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500" placeholder="例如: PARTY SPACE"/></div>
              <div className="col-span-2"><label className="text-xs text-gray-600 mb-1 block font-bold">場地地址 (將顯示於成功頁面)</label><input type="text" value={localVenueAddress} onChange={e => setLocalVenueAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500" placeholder="例如: 香港九龍觀塘開源道xx號"/></div>
              <div className="col-span-2"><label className="text-xs text-gray-600 mb-1 block font-bold">自訂 Logo 圖片網址 (選填)</label><input type="text" value={localLogoUrl} onChange={e => setLocalLogoUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500" placeholder="https://example.com/logo.png"/></div>
            </div>
          </div>

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
          <div className="space-y-3">
            <h3 className="text-lg font-black text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><DollarSign size={20}/> 場地定價參數</h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div><label className="text-xs text-gray-500 mb-1 block">最低消費</label><input type="number" value={localPricing.minCharge} onChange={e => handlePriceChange('minCharge', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">場地按金</label><input type="number" value={localPricing.deposit} onChange={e => handlePriceChange('deposit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold focus:border-indigo-500"/></div>
            </div>
          </div>
          
          <div className="space-y-3 border-t-2 border-indigo-50 pt-6">
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

        <div className="space-y-4">
          <div className="flex justify-between items-end border-b-2 border-indigo-100 pb-2">
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><Plus size={20}/> 自訂加購服務</h3>
            <button onClick={() => setLocalAddons([...localAddons, { id: 'a' + Date.now(), name: '新加購', price: 100, leadTime: '' }])} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">+ 新增</button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {localAddons.map((addon, index) => (
              <div key={addon.id} className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input type="text" value={addon.name} onChange={e => handleAddonChange(index, 'name', e.target.value)} className="w-full border-b px-1 py-1 text-sm font-bold focus:border-indigo-500"/>
                  <div className="flex gap-2">
                    <div className="flex-1"><label className="text-[10px] text-gray-400 block">價格</label><input type="number" value={addon.price} onChange={e => handleAddonChange(index, 'price', e.target.value)} className="w-full border rounded px-2 py-1 text-sm"/></div>
                  </div>
                </div>
                <button onClick={() => setLocalAddons(localAddons.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-lg"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t pt-5 bg-gray-50 p-6 flex justify-between items-center"><div className="text-green-600 font-bold text-sm">{saveStatus}</div><button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl">儲存並同步至雲端</button></div>
    </div>
  );
}

// ==========================================
// 共用組件 (日曆等)
// ==========================================
function MiniCalendar({ selectedDate, onSelectDate, bookedData }) {
  const today = new Date(2026, 3, 21);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 3, 1));
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isSelected = selectedDate === dateString;
      const bookedSlots = bookedData[dateString] || [];
      const isFullyBooked = bookedSlots.length >= 3;

      let btnClass = "h-10 w-full rounded-full flex items-center justify-center text-sm font-medium transition-colors relative ";
      let disabled = false;
      if (isPast) { btnClass += "text-gray-300 cursor-not-allowed"; disabled = true; }
      else if (isFullyBooked) { btnClass += "bg-gray-200 text-gray-400 cursor-not-allowed line-through"; disabled = true; }
      else if (isSelected) { btnClass += "bg-indigo-600 text-white shadow-md z-10"; }
      else if (bookedSlots.length > 0) { btnClass += "bg-white text-gray-800 hover:bg-indigo-50 border border-yellow-300"; }
      else { btnClass += "bg-white text-gray-800 hover:bg-indigo-50 border border-transparent"; }

      days.push(
        <button key={day} disabled={disabled} onClick={() => onSelectDate(dateString)} className={btnClass}>
          {day}{!isPast && !isFullyBooked && bookedSlots.length > 0 && !isSelected && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>}
        </button>
      );
    }
    return days;
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
        <div className="font-bold text-gray-800">{currentMonth.getFullYear()} 年 {currentMonth.getMonth() + 1} 月</div>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">{['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-xs font-bold text-gray-400">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
    </div>
  );
}

function LoginModal({ onClose, onSuccess }) {
  const [pwd, setPwd] = useState(''); const [error, setError] = useState('');
  const handleLogin = (e) => { e.preventDefault(); if (pwd === 'admin123') onSuccess(); else setError('密碼錯誤'); };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        <div className="flex flex-col items-center mb-6"><div className="bg-indigo-100 p-3 rounded-full mb-3"><Lock className="text-indigo-600" size={24} /></div><h2 className="text-xl font-bold text-gray-800">員工後台登入</h2></div>
        <form onSubmit={handleLogin}><input type="password" placeholder="admin123" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-2" value={pwd} onChange={(e) => {setPwd(e.target.value); setError('');}} autoFocus/>{error && <p className="text-red-500 text-xs mb-3 pl-1">{error}</p>}<button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl">登入系統</button></form>
      </div>
    </div>
  );
}

function SessionButton({ type, label, time, icon: Icon, colorClass, currentSelection, onSelect, bookedSlots }) {
  const isBooked = bookedSlots.includes(type);
  const isSelected = currentSelection === type;
  
  const iconColorMap = {
    'MORNING': 'text-amber-500',
    'AFTERNOON': 'text-orange-500',
    'NIGHT': 'text-indigo-500'
  };

  if (isBooked) {
    return (
      <div className="border border-gray-200 bg-gray-100 rounded-xl p-3 flex flex-col items-center justify-center opacity-60 cursor-not-allowed">
        <Icon size={24} className="text-gray-400 mb-1" />
        <div className="text-sm font-bold text-gray-500">{label}</div>
        <div className="text-[10px] text-gray-400">{time}</div>
        <div className="text-[10px] text-red-500 font-bold mt-1 bg-red-50 px-1 rounded border border-red-100">已訂滿</div>
      </div>
    );
  }
  
  return (
    <button 
      onClick={() => onSelect(type)}
      className={`border rounded-xl p-3 flex flex-col items-center justify-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
    >
      <Icon size={24} className={`mb-1 ${isSelected ? 'text-indigo-600' : (iconColorMap[type] || 'text-gray-500')}`} />
      <div className={`text-sm font-bold ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</div>
      <div className={`text-[10px] ${isSelected ? 'text-indigo-500' : 'text-gray-500'}`}>{time}</div>
      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5"></div>}
    </button>
  );
}
