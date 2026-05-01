const fs = require('fs');

function updateFile() {
  let code = fs.readFileSync('src/App.tsx', 'utf8');

  // 1. Add OfflineMode State
  code = code.replace(
    "const [authLoading, setAuthLoading] = useState(true);",
    "const [authLoading, setAuthLoading] = useState(true);\n  const [isOfflineMode, setIsOfflineMode] = useState(() => {\n    if (typeof window !== 'undefined') {\n      return localStorage.getItem('isOfflineMode') === 'true';\n    }\n    return false;\n  });"
  );

  // 2. Auth Effect
  code = code.replace(
    "const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {",
    "if (isOfflineMode) {\n      setAuthLoading(false);\n      return;\n    }\n    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {"
  );

  // 3. fetching Effect
  code = code.replace(
    "  useEffect(() => {\n    if (!user) return;\n\n    const pathForOnSnapshot",
    "  useEffect(() => {\n    if (isOfflineMode) {\n      try {\n        const stored = localStorage.getItem('offlineCards');\n        if (stored) {\n          setCards(JSON.parse(stored));\n        }\n      } catch (e) { console.error('Error loading offline cards:', e); }\n      return;\n    }\n    if (!user) return;\n\n    const pathForOnSnapshot"
  );

  // 4. offline cards updater helper
  code = code.replace(
    "  const isValidFee = (fee: string) => {",
    "  const saveOfflineCards = (newCards: Card[]) => {\n    setCards(newCards);\n    localStorage.setItem('offlineCards', JSON.stringify(newCards));\n  };\n\n  const isValidFee = (fee: string) => {"
  );

  // 5. addCard method changes - checking user
  code = code.replace(
    "    if (!user || !newCard.trim() || isAddingCard) return;\n",
    "    if ((!user && !isOfflineMode) || !newCard.trim() || isAddingCard) return;\n"
  );

  // addCard inside try block map
  code = code.replace(
    "      const cardsCollectionRef = collection(db, `users/${user.uid}/cards`);\n      await Promise.all(cardNames.map(async (cardName) => {",
    `      const cardsCollectionRef = isOfflineMode ? null : collection(db, \`users/\${user?.uid}/cards\`);\n      let newOfflineCards = [...cards];\n      await Promise.all(cardNames.map(async (cardName) => {`
  );

  code = code.replace(
    "        const newCardRef = doc(cardsCollectionRef);",
    "        const newCardId = isOfflineMode ? Math.random().toString(36).substr(2, 9) : doc(cardsCollectionRef!).id;"
  );

  code = code.replace(
    /        await setDoc\(newCardRef, cardData\);\n/g,
    `        if (isOfflineMode) {\n          newOfflineCards.push({ id: newCardId, ...cardData });\n        } else {\n          const newCardRef = doc(db, \`users/\${user?.uid}/cards\`, newCardId);\n          await setDoc(newCardRef, cardData);\n        }\n`
  );

  // Add the save operation after the promise.all completes in addCard
  code = code.replace(
    "        await setDoc(newCardRef, cardData);\n      }));",
    "      }));\n      if (isOfflineMode) saveOfflineCards(newOfflineCards);"
  );


  // 6. removeCard
  code = code.replace(
    "  const removeCard = async (cardToRemoveId: string) => {\n    if (!user) return;\n    const pathForDelete = `users/${user.uid}/cards/${cardToRemoveId}`;",
    "  const removeCard = async (cardToRemoveId: string) => {\n    if (!user && !isOfflineMode) return;\n    if (isOfflineMode) {\n      saveOfflineCards(cards.filter(c => c.id !== cardToRemoveId));\n      return;\n    }\n    const pathForDelete = `users/${user?.uid}/cards/${cardToRemoveId}`;"
  );

  // 7. saveEdit
  code = code.replace(
    "  const saveEdit = async (cardId: string) => {\n    if (!user) return;\n",
    "  const saveEdit = async (cardId: string) => {\n    if (!user && !isOfflineMode) return;\n"
  );

  code = code.replace(
    "    const pathForWrite = `users/${user.uid}/cards/${cardId}`;",
    "    const pathForWrite = `users/${user?.uid}/cards/${cardId}`;"
  );

  code = code.replace(
    "      await setDoc(doc(db, pathForWrite), updateData, { merge: true });\n      setEditingCardId(null);\n    } catch (error)",
    "      if (isOfflineMode) {\n        saveOfflineCards(cards.map(c => c.id === cardId ? { ...c, ...updateData } : c));\n      } else {\n        await setDoc(doc(db, pathForWrite), updateData, { merge: true });\n      }\n      setEditingCardId(null);\n    } catch (error)"
  );

  // Now, the Login UI
  // And the header action handles OfflineMode
  code = code.replace(
    "                <p className=\"text-slate-500 dark:text-zinc-400 mb-8\">Sign in to securely manage your connected cards and maximize your rewards.</p>\n                <button\n                  onClick={handleLogin}\n                  className=\"w-full flex items-center justify-center gap-3 py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2\"\n                >\n                  <LogIn className=\"w-5 h-5\" />\n                  Sign in with Google\n                </button>",
    `                <p className="text-slate-500 dark:text-zinc-400 mb-8">Sign in to securely manage your connected cards, or use the app offline.</p>
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
                </div>`
  );

  // Modifying the return statement to show the offline button check
  code = code.replace(
    "if (authLoading) {\n    return (\n      <div className=\"min-h-screen",
    "if (authLoading && !isOfflineMode) {\n    return (\n      <div className=\"min-h-screen"
  );
  
  code = code.replace(
    "if (!user) {\n    return (\n      <div className=\"min-h-screen",
    "if (!user && !isOfflineMode) {\n    return (\n      <div className=\"min-h-screen"
  );

  // In the header, display Offline tag
  code = code.replace(
    "              <WalletCards className=\"w-5 h-5\" />\n            </div>\n            <div className=\"font-extrabold text-[20px]",
    `              <WalletCards className="w-5 h-5" />
            </div>
            <div className="font-extrabold text-[20px] text-slate-900 dark:text-zinc-50 tracking-tight tracking-[-0.5px]">CardMaximizer</div>
            {isOfflineMode && <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">Offline</span>}`
  );
  code = code.replace(
    "<div className=\"font-extrabold text-[20px] text-slate-900 dark:text-zinc-50 tracking-tight tracking-[-0.5px]\">CardMaximizer</div>\n            <p",
    "<p"
  );

  // Logout / clear data for offline
  code = code.replace(
    "            <button\n              onClick={handleLogout}\n              className=\"text-slate-500 dark:text-zinc-400 hover:text-red-400 p-2 border border-slate-200 dark:border-zinc-800 hover:border-red-900 rounded-lg hover:bg-red-900/30 transition-colors\"\n              title=\"Sign Out\"\n            >",
    `            <button
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
            >`
  );

  fs.writeFileSync('src/App.tsx', code);
}
updateFile();
