import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Search, Plus, Trash2, Sparkles, ChevronDown, ChevronUp, WalletCards, LogOut, LogIn, ArrowDownAZ, ArrowDownZA, Pencil, Sun, Moon } from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import Markdown from 'react-markdown';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Card {
  id: string;
  name: string;
  rewardRate?: string;
  annualFee?: string;
  foreignTransactionFee?: string;
  benefits?: string;
  isLTF?: boolean;
  joiningFee?: string;
  imageUrl?: string;
}

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [newCard, setNewCard] = useState('');
  const [newRewardRate, setNewRewardRate] = useState('');
  const [newAnnualFee, setNewAnnualFee] = useState('');
  const [newJoiningFee, setNewJoiningFee] = useState('');
  const [newForeignTransactionFee, setNewForeignTransactionFee] = useState('');
  const [newBenefits, setNewBenefits] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [category, setCategory] = useState('');
  const [transactionType, setTransactionType] = useState<'any' | 'online' | 'offline'>('any');
  const [specificLounge, setSpecificLounge] = useState('');
  const [loungeType, setLoungeType] = useState<'domestic' | 'international' | ''>('');
  const [recommendation, setRecommendation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAltLoading, setIsAltLoading] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('isOfflineMode') === 'true';
    }
    return false;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [addCardNotification, setAddCardNotification] = useState<{ message: string, type: 'error' | 'info' | 'success' } | null>(null);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editIsLTF, setEditIsLTF] = useState(false);
  const [editJoiningFee, setEditJoiningFee] = useState('');
  const [editAnnualFee, setEditAnnualFee] = useState('');
  const [editForeignTransactionFee, setEditForeignTransactionFee] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editCardNotification, setEditCardNotification] = useState<{ message: string, type: 'error' | 'info' | 'success' } | null>(null);
  const [cardFilter, setCardFilter] = useState<'all' | 'ltf' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCards = [...cards].filter(card => {
    if (searchQuery.trim() !== '' && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (cardFilter === 'all') return true;
    if (cardFilter === 'ltf') return card.isLTF;
    if (cardFilter === 'paid') return !card.isLTF;
    return true;
  });

  const sortedCards = filteredCards.sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });

  useEffect(() => {
    if (isOfflineMode) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Ensure user document exists
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setCards([]); // Clear cards on logout
      }
    });
    return () => unsubscribe();
  }, [isOfflineMode]);

  useEffect(() => {
    if (isOfflineMode) {
      try {
        const stored = localStorage.getItem('offlineCards');
        if (stored) {
          setCards(JSON.parse(stored));
        }
      } catch (e) { console.error('Error loading offline cards:', e); }
      return;
    }
    if (!user) return;

    const pathForOnSnapshot = `users/${user.uid}/cards`;
    const unsubscribe = onSnapshot(collection(db, pathForOnSnapshot), (snapshot) => {
      const loadedCards: Card[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedCards.push({ 
          id: doc.id, 
          name: data.name, 
          rewardRate: data.rewardRate,
          annualFee: data.annualFee,
          foreignTransactionFee: data.foreignTransactionFee,
          benefits: data.benefits,
          isLTF: data.isLTF,
          joiningFee: data.joiningFee,
          imageUrl: data.imageUrl
        });
      });
      setCards(loadedCards);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    });

    return () => unsubscribe();
  }, [user, isOfflineMode]);

  const saveOfflineCards = (newCards: Card[]) => {
    setCards(newCards);
    localStorage.setItem('offlineCards', JSON.stringify(newCards));
  };

  const isValidFee = (fee: string) => {
    if (!fee.trim()) return true;
    return !isNaN(Number(fee.trim()));
  };

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!user && !isOfflineMode) || !newCard.trim() || isAddingCard) return;

    if (!isValidFee(newAnnualFee)) {
      setAddCardNotification({ message: 'Annual Fee must be a valid number.', type: 'error' });
      return;
    }
    if (!isValidFee(newJoiningFee)) {
      setAddCardNotification({ message: 'Joining Fee must be a valid number.', type: 'error' });
      return;
    }
    if (!isValidFee(newForeignTransactionFee)) {
      setAddCardNotification({ message: 'Foreign Transaction Fee must be a valid number.', type: 'error' });
      return;
    }

    setIsAddingCard(true);
    setAddCardNotification(null);
    const rawCardNames = newCard.split(',').map(name => name.trim()).filter(name => name.length > 0);
    const cardNames = Array.from(new Set(rawCardNames));
    
    if (cardNames.length === 0) {
      setIsAddingCard(false);
      return;
    }

    const duplicates = cardNames.filter(name => cards.some(c => c.name.toLowerCase() === name.toLowerCase()));
    if (duplicates.length > 0) {
      setAddCardNotification({ 
        message: `Card(s) already exist: ${duplicates.join(', ')}`, 
        type: 'error' 
      });
      setIsAddingCard(false);
      return;
    }

    try {
      const cardsCollectionRef = isOfflineMode ? null : collection(db, `users/${user?.uid}/cards`);
      let newOfflineCards = [...cards];
      await Promise.all(cardNames.map(async (cardName) => {
        const newCardId = isOfflineMode ? Math.random().toString(36).substr(2, 9) : doc(cardsCollectionRef!).id;
        const cardData: any = {
          name: cardName,
          addedAt: isOfflineMode ? Date.now() : serverTimestamp()
        };
        if (newRewardRate.trim()) cardData.rewardRate = newRewardRate.trim();
        if (newJoiningFee.trim()) cardData.joiningFee = newJoiningFee.trim();
        if (newAnnualFee.trim()) cardData.annualFee = newAnnualFee.trim();
        if (newForeignTransactionFee.trim()) cardData.foreignTransactionFee = newForeignTransactionFee.trim();
        if (newBenefits.trim()) cardData.benefits = newBenefits.trim();
        
        let fetchedImageUrl = newImageUrl.trim();
        if (!fetchedImageUrl && !isOfflineMode && navigator.onLine) {
          const fetchImageFromGemini = async (isRetry = false) => {
            try {
              const prompt = isRetry
                ? `The first image URL search for the "${cardName}" credit card failed. Please try again. Return ONLY the raw valid URL string of the image (.png, .jpg, etc). Must start with http or https. No quotes or formatting.`
                : `Find a publicly accessible high-quality image URL of the "${cardName}" credit card. Return ONLY the raw valid URL string. Do not include any markdown formatting, explanation, or quotes. If you cannot find one reliably, return exactly the word "null".`;

              const generatePromise = ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                  temperature: isRetry ? 0.3 : 0,
                  tools: [{ googleSearch: {} }],
                }
              });

              const timeoutPromise = new Promise<{text?: string}>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout after 8 seconds')), 8000);
              });

              const imageResponse = await Promise.race([generatePromise, timeoutPromise]) as {text?: string};
              
              const urlText = (imageResponse.text || '').trim();
              if (urlText && urlText !== 'null') {
                // Validate URL
                try {
                  const url = new URL(urlText);
                  if (url.protocol === 'http:' || url.protocol === 'https:') {
                    return url.href;
                  }
                } catch (urlError) {
                  console.warn(`Invalid URL format returned for ${cardName}: ${urlText}`);
                  return null;
                }
              }
              return null;
            } catch (e) {
              console.error(`Gemini image fetch failed (retry: ${isRetry})`, e);
              return null;
            }
          };

          // 1st attempt
          let imgUrl = await fetchImageFromGemini(false);
          
          // Fallback mechanism: retry once if failed
          if (!imgUrl) {
            console.warn(`First attempt to fetch image for ${cardName} failed. Initiating standard fallback (retry)...`);
            imgUrl = await fetchImageFromGemini(true);
          }
          
          if (imgUrl) {
            fetchedImageUrl = imgUrl;
          } else {
            console.log(`Using default gradient placeholder since image fetching failed for ${cardName}.`);
            setAddCardNotification({
              message: `We couldn't automatically find an image for "${cardName}". A default placeholder has been used instead. You can edit the card later to add your own image URL.`,
              type: 'info'
            });
            // Will remain empty and use default placeholder.
          }
        } else if (!fetchedImageUrl && (isOfflineMode || !navigator.onLine)) {
             console.log(`Skipping Gemini image fetch for ${cardName} due to offline mode.`);
        }
        
        if (fetchedImageUrl) cardData.imageUrl = fetchedImageUrl;
        
        if (isOfflineMode) {
          newOfflineCards.push({ id: newCardId, ...cardData });
        } else {
          const newCardRef = doc(db, `users/${user?.uid}/cards`, newCardId);
          await setDoc(newCardRef, cardData);
        }
      }));

      if (isOfflineMode) {
        saveOfflineCards(newOfflineCards);
      }

      setNewCard('');
      setNewRewardRate('');
      setNewJoiningFee('');
      setNewAnnualFee('');
      setNewForeignTransactionFee('');
      setNewBenefits('');
      setNewImageUrl('');
      setShowAdvancedDetails(false);
    } catch (error) {
      if (!isOfflineMode) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user?.uid}/cards`);
      }
      setAddCardNotification({
        message: 'Could not add the card. Make sure you have the correct permissions.',
        type: 'error'
      });
    } finally {
      setIsAddingCard(false);
    }
  };

  const removeCard = async (cardToRemoveId: string) => {
    if (!user && !isOfflineMode) return;
    if (isOfflineMode) {
      saveOfflineCards(cards.filter(c => c.id !== cardToRemoveId));
      return;
    }
    const pathForDelete = `users/${user?.uid}/cards/${cardToRemoveId}`;
    try {
      await deleteDoc(doc(db, pathForDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, pathForDelete);
    }
  };

  const startEditing = (card: Card) => {
    setEditingCardId(card.id);
    setEditIsLTF(card.isLTF || false);
    setEditJoiningFee(card.joiningFee || '');
    setEditAnnualFee(card.annualFee || '');
    setEditForeignTransactionFee(card.foreignTransactionFee || '');
    setEditImageUrl(card.imageUrl || '');
    setEditCardNotification(null);
  };

  const saveEdit = async (cardId: string) => {
    if (!user && !isOfflineMode) return;
    
    if (!editIsLTF) {
      if (!isValidFee(editAnnualFee)) {
        setEditCardNotification({ message: 'Annual Fee must be a valid number.', type: 'error' });
        return;
      }
      if (!isValidFee(editJoiningFee)) {
        setEditCardNotification({ message: 'Joining Fee must be a valid number.', type: 'error' });
        return;
      }
    }
    if (!isValidFee(editForeignTransactionFee)) {
      setEditCardNotification({ message: 'Foreign Transaction Fee must be a valid number.', type: 'error' });
      return;
    }

    const pathForWrite = `users/${user?.uid}/cards/${cardId}`;
    try {
      const updateData: any = {};
      updateData.isLTF = editIsLTF;
      if (!editIsLTF) {
        if (editJoiningFee.trim() !== '') updateData.joiningFee = editJoiningFee.trim();
        else updateData.joiningFee = '';
        if (editAnnualFee.trim() !== '') updateData.annualFee = editAnnualFee.trim();
        else updateData.annualFee = '';
      } else {
        updateData.joiningFee = '';
        updateData.annualFee = '';
      }
      
      if (editForeignTransactionFee.trim() !== '') updateData.foreignTransactionFee = editForeignTransactionFee.trim();
      else updateData.foreignTransactionFee = '';
      
      if (editImageUrl.trim() !== '') updateData.imageUrl = editImageUrl.trim();
      else updateData.imageUrl = '';
      
      if (isOfflineMode) {
        saveOfflineCards(cards.map(c => c.id === cardId ? { ...c, ...updateData } : c));
      } else {
        await setDoc(doc(db, pathForWrite), updateData, { merge: true });
      }
      setEditingCardId(null);
    } catch (error) {
      if (!isOfflineMode) {
        handleFirestoreError(error, OperationType.UPDATE, pathForWrite);
      }
      setEditCardNotification({ message: 'Could not update the card. Make sure you have the correct permissions.', type: 'error' });
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const findBestCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || cards.length === 0) return;

    setIsLoading(true);
    setRecommendation('');

    try {
      const prompt = `I have the following credit cards in my wallet:
${cards.map(c => {
  let details = [];
  if (c.rewardRate) details.push(`Base rate: ${c.rewardRate}`);
  if (c.isLTF) details.push(`Lifetime Free (LTF)`);
  else {
    if (c.joiningFee) details.push(`Join Fee: ${c.joiningFee}`);
    if (c.annualFee) details.push(`Annual Fee: ${c.annualFee}`);
  }
  if (c.foreignTransactionFee) details.push(`FTF: ${c.foreignTransactionFee}`);
  if (c.benefits) details.push(`Benefits: ${c.benefits}`);
  return `- ${c.name}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
}).join('\n')}

I want to make a purchase in the following category: "${category}".
${category.toLowerCase().includes('lounge access') && specificLounge ? `Specifically for this lounge: "${specificLounge}".` : ''}
${category.toLowerCase().includes('lounge access') && loungeType ? `This is a ${loungeType} lounge.` : ''}
${transactionType !== 'any' ? `This will be an ${transactionType} transaction.` : ''}

Based on current real-world credit card reward structures, which of my cards is the absolute best to use for this specific category to maximize rewards, cashback, or points? 
CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
- DO NOT hallucinate reward points. Rely *only* on the actual, verified, current terms and conditions of these specific credit cards.
- Pay extremely close attention to exclusions. Many cards (e.g., Scapia) give zero reward points for international transactions. Many cards exclude fuel, rent, wallet loads, or utilities. 
- If a card provides zero points for this category, state so explicitly. Do not assume a baseline reward rate applies if the category is typically excluded.

When evaluating the best card, please carefully consider:
1. Complex reward structures including tiered multipliers and bonus categories for this specific spend.
2. The actual monetary value of different reward redemption options (e.g., explicitly distinguish if 1 point = 1 cent for cashback, or 1 point = 1.5 cents for travel transfer partners). Use realistic, accepted point valuations in your calculation.
3. The effective return percentage (effective reward rate), factoring in the actual monetary value of the points earned minus any applicable fees (e.g., foreign transaction fees).

Please state the best card clearly, its expected effective reward rate (as a %), and provide a brief step-by-step mathematical explanation of your calculation explicitly showing the point valuation used. Keep the response concise and formatted with markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setRecommendation(response.text || 'Could not determine the best card.');
    } catch (error: any) {
      console.error('Error from Gemini API:', error);
      let isQuota = false;
      let errMsg = String(error);
      
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('spend cap')) {
        isQuota = true;
      } else if (error?.error?.code === 429 || error?.error?.message?.includes('spend cap')) {
        isQuota = true;
      } else if (error instanceof Error) {
        errMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errMsg = JSON.stringify(error);
        if (errMsg.includes('429') || errMsg.includes('spend cap')) {
          isQuota = true;
        }
      }

      const msg = isQuota ? 'You have exceeded your monthly spending cap for the Gemini API. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.' : errMsg;
      setRecommendation(`An error occurred: ${msg}\n\nPlease try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const getAlternatives = async () => {
    if (!category.trim() || cards.length === 0 || !recommendation) return;

    setIsAltLoading(true);

    try {
      const prompt = `I have the following credit cards in my wallet:
${cards.map(c => {
  let details = [];
  if (c.rewardRate) details.push(`Base rate: ${c.rewardRate}`);
  if (c.isLTF) details.push(`Lifetime Free (LTF)`);
  else {
    if (c.joiningFee) details.push(`Join Fee: ${c.joiningFee}`);
    if (c.annualFee) details.push(`Annual Fee: ${c.annualFee}`);
  }
  if (c.foreignTransactionFee) details.push(`FTF: ${c.foreignTransactionFee}`);
  if (c.benefits) details.push(`Benefits: ${c.benefits}`);
  return `- ${c.name}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
}).join('\n')}

I want to make a purchase in the following category: "${category}".
${category.toLowerCase().includes('lounge access') && specificLounge ? `Specifically for this lounge: "${specificLounge}".` : ''}
${category.toLowerCase().includes('lounge access') && loungeType ? `This is a ${loungeType} lounge.` : ''}
${transactionType !== 'any' ? `This will be an ${transactionType} transaction.` : ''}

You previously recommended the following:
"${recommendation}"

Now, please provide 1 or 2 alternative cards from my wallet that would be the next best options for this category. 
CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
- DO NOT hallucinate reward points. Rely *only* on the actual, verified, current terms and conditions of these specific credit cards.
- Pay extremely close attention to exclusions. Many cards give zero reward points for international transactions (e.g., Scapia), fuel, rent, wallet loads, or utilities. 
- If a card provides zero points for this category, state so explicitly.

When evaluating alternatives, consider complex reward structures (tiered rates, bonus categories), and most importantly, the actual monetary value of the specific reward points when redeemed (e.g., 1 point = 1 cent for cashback vs 1 point = 1.5 cents for travel). Use realistic, accepted point valuations.
State the alternative cards clearly, their expected effective reward rate (as a %), explain your calculation explicitly showing the point valuation used, and why they are good backups. Keep the response concise and formatted with markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setRecommendation((prev) => prev + '\n\n---\n\n### Alternative Suggestions\n\n' + (response.text || 'Could not determine alternative cards.'));
    } catch (error: any) {
      console.error('Error from Gemini API:', error);
      let isQuota = false;
      let errMsg = String(error);
      
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('spend cap')) {
        isQuota = true;
      } else if (error?.error?.code === 429 || error?.error?.message?.includes('spend cap')) {
        isQuota = true;
      } else if (error instanceof Error) {
        errMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errMsg = JSON.stringify(error);
        if (errMsg.includes('429') || errMsg.includes('spend cap')) {
          isQuota = true;
        }
      }

      const msg = isQuota ? 'You have exceeded your monthly spending cap for the Gemini API. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.' : errMsg;
      setRecommendation((prev) => prev + `\n\n---\n\nAn error occurred while finding alternatives: ${msg}\n\nPlease try again.`);
    } finally {
      setIsAltLoading(false);
    }
  };

  if (authLoading && !isOfflineMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-zinc-950 p-6">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user && !isOfflineMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-950 p-6 text-slate-800 dark:text-zinc-200 font-sans selection:bg-amber-500 dark:bg-amber-800 selection:text-amber-900 dark:text-amber-100">
        <div className="bg-white dark:bg-zinc-900 p-8 md:p-12 rounded-[24px] shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1)] text-center max-w-md w-full">
          <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <WalletCards className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 mb-2">Card Maximiser</h1>
          <p className="text-slate-500 dark:text-zinc-400 mb-8">Sign in to securely manage your connected cards, or use the app offline.</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </button>
            <button
              onClick={() => {
                setIsOfflineMode(true);
                localStorage.setItem('isOfflineMode', 'true');
                setAuthLoading(false);
              }}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-semibold rounded-2xl transition-all shadow-sm focus:outline-none focus:ring-2"
            >
              Use Offline Only
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 font-sans selection:bg-amber-500 dark:bg-amber-800 selection:text-amber-900 dark:text-amber-100">
      {/* Sidebar for Desktop, Collapsible Section for Mobile */}
      <aside className="w-full md:w-[24rem] lg:w-[28rem] xl:w-[32rem] bg-white dark:bg-zinc-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-zinc-800 flex flex-col shrink-0 md:h-screen md:sticky md:top-0">
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 p-1.5 rounded-lg shadow-sm">
                <WalletCards className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-[20px] text-slate-900 dark:text-zinc-50 tracking-tight tracking-tight">Card Maximiser</div>
              {isOfflineMode && <span className="ml-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">Offline</span>}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-zinc-400 mt-1 hidden md:block">Manage {cards.length} Connected Cards</p>
          </div>
          <div className="flex items-center gap-2 mt-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="text-slate-500 dark:text-zinc-400 p-2 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-zinc-800 transition-colors"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                if (isOfflineMode) {
                  setIsOfflineMode(false);
                  localStorage.removeItem('isOfflineMode');
                } else {
                  handleLogout();
                }
              }}
              className="text-slate-500 dark:text-zinc-400 hover:text-red-400 p-2 border border-slate-200 dark:border-zinc-800 hover:border-red-900 rounded-lg hover:bg-red-900/30 transition-colors"
              title={isOfflineMode ? "Leave Offline Mode" : "Sign Out"}
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsWalletOpen(!isWalletOpen)}
              className="md:hidden text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-200 p-2"
            >
              {isWalletOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className={`md:flex flex-col flex-1 overflow-hidden md:overflow-y-auto ${isWalletOpen ? 'flex' : 'hidden'}`}>
          <div className="p-4 flex flex-col gap-4">
            {addCardNotification && (
              <div className={`p-3 text-xs md:text-sm rounded-xl border ${addCardNotification.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-900' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'} mb-2`}>
                {addCardNotification.message}
              </div>
            )}
            <form onSubmit={addCard} className="flex flex-col gap-2">
              <input
                type="text"
                value={newCard}
                onChange={(e) => {
                  setNewCard(e.target.value);
                  if (addCardNotification) setAddCardNotification(null);
                }}
                placeholder="Card names (e.g., HDFC Infinia, SBI Elite)"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRewardRate}
                  onChange={(e) => setNewRewardRate(e.target.value)}
                  placeholder="Base rate (optional)"
                  className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                  className="px-3 py-2 bg-slate-100 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-zinc-800 focus:outline-none transition-all text-sm shrink-0 flex items-center justify-center"
                  title="Toggle advanced details"
                >
                  {showAdvancedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              
              {showAdvancedDetails && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newJoiningFee}
                      onChange={(e) => setNewJoiningFee(e.target.value)}
                      placeholder="Joining Fee"
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 transition-all text-xs"
                    />
                    <input
                      type="text"
                      value={newAnnualFee}
                      onChange={(e) => setNewAnnualFee(e.target.value)}
                      placeholder="Annual Fee"
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 transition-all text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={newForeignTransactionFee}
                    onChange={(e) => setNewForeignTransactionFee(e.target.value)}
                    placeholder="Foreign Tx Fee"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 transition-all text-xs"
                  />
                  <input
                    type="text"
                    value={newBenefits}
                    onChange={(e) => setNewBenefits(e.target.value)}
                    placeholder="Key Benefits (e.g., Lounge access, Insurance)"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 transition-all text-xs"
                  />
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Card Image URL (Optional)"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 transition-all text-xs"
                  />
                </div>
              )}
              
              <button
                type="submit"
                disabled={!newCard.trim() || isAddingCard}
                className="w-full px-4 py-2 mt-1 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:opacity-50 transition-all text-sm shadow-sm"
              >
                {isAddingCard ? 'Adding...' : 'Add Card'}
              </button>
            </form>

            <div className="flex flex-col gap-3">
              {cards.length > 0 && (
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Your Cards ({cards.length})</span>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-200 transition-colors bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 px-2 py-1.5 rounded-lg shrink-0"
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  >
                    {sortOrder === 'asc' ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowDownZA className="w-3.5 h-3.5" />}
                    Sort
                  </button>
                </div>
              )}
              {sortedCards.length > 0 ? (
                sortedCards.map((card, idx) => {
                  const thumbGradients = [
                    'bg-gradient-to-br from-indigo-500 to-indigo-700',
                    'bg-gradient-to-br from-purple-500 to-purple-700',
                    'bg-gradient-to-br from-emerald-500 to-emerald-700',
                    'bg-gradient-to-br from-amber-500 to-amber-700',
                    'bg-gradient-to-br from-rose-500 to-rose-700',
                    'bg-gradient-to-br from-slate-600 to-slate-800',
                    'bg-gradient-to-br from-sky-500 to-sky-700'
                  ];
                  const thumbGradient = thumbGradients[idx % thumbGradients.length];

                  return editingCardId === card.id ? (
                    <div key={card.id} className="group flex flex-col gap-3 p-3 bg-white dark:bg-zinc-900 border border-amber-500 rounded-xl shadow-sm">
                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50 truncate" title={card.name}>
                        {card.name}
                      </span>
                      {editCardNotification && (
                        <div className={`p-2 text-xs rounded-lg border ${editCardNotification.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-900' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'}`}>
                          {editCardNotification.message}
                        </div>
                      )}
                      <div className="flex gap-2 items-center">
                        <button onClick={() => setEditIsLTF(true)} className={`px-2 py-1 text-xs font-medium rounded border ${editIsLTF ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-slate-200 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400'}`}>Lifetime Free</button>
                        <button onClick={() => setEditIsLTF(false)} className={`px-2 py-1 text-xs font-medium rounded border ${!editIsLTF ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400' : 'bg-slate-200 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400'}`}>Paid Card</button>
                      </div>
                      {!editIsLTF && (
                        <div className="flex gap-2">
                          <input type="text" value={editJoiningFee} onChange={e => {
                            setEditJoiningFee(e.target.value);
                            if (editCardNotification) setEditCardNotification(null);
                          }} placeholder="Joining Fee (e.g. 500)" className="flex-1 px-2 py-1.5 border border-slate-200 dark:border-zinc-800 rounded text-xs focus:outline-none focus:border-amber-500 transition-colors" />
                          <input type="text" value={editAnnualFee} onChange={e => {
                            setEditAnnualFee(e.target.value);
                            if (editCardNotification) setEditCardNotification(null);
                          }} placeholder="Annual Fee (e.g. 500)" className="flex-1 px-2 py-1.5 border border-slate-200 dark:border-zinc-800 rounded text-xs focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                      )}
                      <input type="text" value={editForeignTransactionFee} onChange={e => {
                        setEditForeignTransactionFee(e.target.value);
                        if (editCardNotification) setEditCardNotification(null);
                      }} placeholder="Foreign Tx Fee (e.g. 3.5)" className="w-full px-2 py-1.5 border border-slate-200 dark:border-zinc-800 rounded text-xs focus:outline-none focus:border-amber-500 transition-colors" />
                      <input type="text" value={editImageUrl} onChange={e => setEditImageUrl(e.target.value)} placeholder="Card Image URL (Optional)" className="w-full px-2 py-1.5 border border-slate-200 dark:border-zinc-800 rounded text-xs focus:outline-none focus:border-amber-500 transition-colors" />
                      <div className="flex gap-2 justify-end mt-1">
                        <button onClick={() => {
                          setEditingCardId(null);
                          setEditCardNotification(null);
                        }} className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:bg-zinc-950 rounded transition-colors">Cancel</button>
                        <button onClick={() => saveEdit(card.id)} className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors shadow-sm">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div key={card.id} className="group flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-zinc-800 hover:border-slate-300 dark:border-zinc-700 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.name} referrerPolicy="no-referrer" className="w-12 h-8 rounded shrink-0 object-cover border border-slate-200 dark:border-zinc-800" />
                        ) : (
                          <div className={`w-12 h-8 rounded shrink-0 flex items-center justify-center ${thumbGradient} shadow-inner`}>
                            <CreditCard className="w-4 h-4 text-white/80" />
                          </div>
                        )}
                        <div className="flex flex-col truncate gap-0.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50 truncate" title={card.name}>
                            {card.name}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {card.rewardRate && (
                              <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium rounded max-w-[200px]" title={card.rewardRate}>
                                Rate: {card.rewardRate}
                              </span>
                            )}
                            {card.isLTF && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-medium rounded max-w-[100px]" title="Lifetime Free">
                                LTF
                              </span>
                            )}
                            {!card.isLTF && card.joiningFee && (
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 text-[10px] font-medium rounded max-w-[200px]" title={card.joiningFee}>
                                Join: {card.joiningFee}
                              </span>
                            )}
                            {!card.isLTF && card.annualFee && (
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 text-[10px] font-medium rounded max-w-[200px]" title={card.annualFee}>
                                Fee: {card.annualFee}
                              </span>
                            )}
                            {card.foreignTransactionFee && (
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 text-[10px] font-medium rounded max-w-[200px]" title={card.foreignTransactionFee}>
                                FTF: {card.foreignTransactionFee}
                              </span>
                            )}
                            {card.benefits && (
                              <span className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 text-[10px] font-medium rounded max-w-[250px]" title={card.benefits}>
                                + {card.benefits}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0">
                        <button
                          onClick={() => startEditing(card)}
                          className="text-slate-500 dark:text-zinc-400 hover:text-amber-600 transition-colors p-1.5"
                          aria-label="Edit card"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeCard(card.id)}
                          className="text-slate-500 dark:text-zinc-400 hover:text-red-500 transition-colors p-1.5"
                          aria-label="Remove card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 px-4">
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Your wallet is empty. Add your credit cards to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 flex flex-col gap-6 w-full max-w-4xl mx-auto">
        
        {/* Top Controls / Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search cards by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 shadow-sm transition-shadow"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Filter:</span>
            <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800">
            <button
              onClick={() => setCardFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${cardFilter === 'all' ? 'bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:text-zinc-300'}`}
            >
              All
            </button>
            <button
              onClick={() => setCardFilter('ltf')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${cardFilter === 'ltf' ? 'bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:text-zinc-300'}`}
            >
              LTF
            </button>
            <button
              onClick={() => setCardFilter('paid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${cardFilter === 'paid' ? 'bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:text-zinc-300'}`}
            >
              Paid
            </button>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <section className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[24px] shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1)]">
          <h1 className="m-0 mb-4 text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-50">What are you looking for?</h1>
          
          <form onSubmit={findBestCard} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="category" className="sr-only">Spending Category</label>
                <div className="relative">
                  <textarea
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="What are you looking to buy? (e.g., Flight tickets on MakeMyTrip, dining at a local restaurant, or a specific item...)"
                    rows={3}
                    className="w-full px-4 py-3 md:py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-xl text-sm md:text-base outline-none box-border focus:border-amber-500 transition-colors placeholder:text-sm placeholder-slate-400 dark:placeholder-zinc-500 resize-y min-h-[100px]"
                  />
                </div>
              </div>
              
              {/* Online/Offline Toggle */}
              <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl shrink-0 h-[48px] md:h-[52px] items-center w-full md:w-auto">
                {(['any', 'online', 'offline'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTransactionType(type)}
                    className={`flex-1 md:flex-none px-3 py-1.5 h-full rounded-lg text-sm font-medium capitalize transition-colors ${transactionType === type ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-50 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:text-zinc-300'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {category.toLowerCase().includes('lounge access') && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-3">
                <div className="flex bg-emerald-900/30 p-1 rounded-xl shrink-0 h-[48px] md:h-[52px] items-center border border-emerald-900 w-full sm:w-auto">
                  <button type="button" onClick={() => setLoungeType('domestic')} className={`flex-1 sm:flex-none px-4 py-2 h-full rounded-lg text-sm font-medium transition-colors ${loungeType === 'domestic' ? 'bg-white dark:bg-zinc-900 text-emerald-100 shadow-sm' : 'text-emerald-400 hover:text-emerald-100'}`}>Domestic</button>
                  <button type="button" onClick={() => setLoungeType('international')} className={`flex-1 sm:flex-none px-4 py-2 h-full rounded-lg text-sm font-medium transition-colors ${loungeType === 'international' ? 'bg-white dark:bg-zinc-900 text-emerald-100 shadow-sm' : 'text-emerald-400 hover:text-emerald-100'}`}>International</button>
                </div>
                <input
                  type="text"
                  value={specificLounge}
                  onChange={(e) => setSpecificLounge(e.target.value)}
                  placeholder="Which specific lounge? (e.g. 080 Lounge, Encalm)..."
                  className="flex-1 w-full px-4 py-2.5 md:py-3 border-2 border-emerald-900 bg-emerald-900/30 rounded-xl text-sm md:text-base outline-none box-border focus:border-emerald-500 transition-colors placeholder:text-sm placeholder-emerald-600/60 text-emerald-100"
                />
              </motion.div>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {['Fuel', 'Dining', 'Flight Booking', 'Hotel Booking', 'Lounge Access', 'Wallet Load', 'Travel', 'Groceries', 'Movies', 'Bills', 'International Transaction'].map(cat => (
                 <button 
                   key={cat}
                   type="button"
                   onClick={() => setCategory(cat)}
                   className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${category.toLowerCase() === cat.toLowerCase() ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-zinc-800'}`}
                 >
                   {cat}
                 </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!category.trim() || cards.length === 0 || isLoading}
              className="w-full flex items-center justify-center py-3 md:py-4 px-6 mt-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:border-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base md:text-lg shadow-sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Analyzing cards...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-900 dark:text-amber-100" />
                  <span>Maximize Rewards</span>
                </div>
              )}
            </button>
            
            {cards.length === 0 && (
              <p className="text-sm text-red-500 mt-2 text-center">Please add at least one card to your wallet first.</p>
            )}
          </form>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {recommendation && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[1px] text-slate-500 dark:text-zinc-400 font-semibold m-0">
                  Best Card for Current Month
                </p>
                <button
                  type="button"
                  onClick={getAlternatives}
                  disabled={isAltLoading || recommendation.includes("### Alternative Suggestions")}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isAltLoading ? (
                    <div className="w-3 h-3 border-2 border-slate-300 dark:border-zinc-700 border-t-slate-600 dark:border-t-zinc-400 rounded-full animate-spin" />
                  ) : null}
                  {isAltLoading ? 'Finding...' : 'Alternative Suggestions'}
                </button>
              </div>
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-6 md:p-8 rounded-[24px] shadow-[0_20px_25px_-5px_rgb(0,0,0,0.1)] mt-2">
                <div className="markdown-body prose prose-sm md:prose-base prose-invert max-w-none text-white/90">
                  <Markdown>{recommendation}</Markdown>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
