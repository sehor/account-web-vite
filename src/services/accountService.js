import accountAPI from '@/http/accountAPI.js';
import { useAccountStore } from '@/stores/accountStore';




const accountService = {
    async fetchAccounts() {
        const store = useAccountStore();
    
        // 如果 Pinia 中已经有数据，则直接返回
        if (store.accounts.length > 0) {
          return store.accounts;
        }
    
        // 否则从后端获取并更新 Pinia
        try {
          const response = await accountAPI.getAllAccounts();
          store.accounts = response.data;  // 更新 Pinia 状态
          return response.data;
        } catch (error) {
          console.error('Failed to fetch accounts:', error);
          throw error;
        }
      },

      async fetchById(id) {
        const store = useAccountStore();
    
        // 在 Pinia 中查找
        const account = store.accounts.find(acc => acc.id === id);
        if (account) {
          return account;
        }
    
        // 如果 Pinia 中没有该账户，则从后端获取
        try {
          const response = await accountAPI.getAccountById(id);
          // 可选：将该账户数据添加到 Pinia 中
          store.accounts.push(response.data);
          return response.data;
        } catch (error) {
          console.error(`Failed to fetch account with id ${id}:`, error);
          throw error;
        }
      },


    async updateAccount(accountData) {
    try {
      const response = await accountAPI.updateAccount(accountData);
      const store = useAccountStore();
      const index = store.accounts.findIndex(acc => acc.id === response.id);
      if (index !== -1) {
        store.accounts[index] = response;
      }

      return response;
    } catch (error) {
      console.error('Failed to update account:', error);
      return { success: false, error };
    }
  },

  async deleteAccount(id) {
    try {
      const response = await accountAPI.deleteAccount(id);
      const store = useAccountStore();
      store.deleteAccount(id);
      return response;
    } catch (error) {
      //console.error('删除账户失败:', error);
      throw error; // 重新抛出错误，以便调用者可以处理它
    }
  },

  async addAccount(accountData) {
    try {
      const response = await accountAPI.createAccount(accountData);
         
      const store = useAccountStore();
      store.accounts.push(response);
      return response;
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  },

  searchAccounts(query) {
    const store = useAccountStore();
  
    // 在 Pinia 中执行搜索
    const results = store.accounts.filter(account =>
      account.name.toLowerCase().includes(query.toLowerCase()) ||
      account.id.includes(query)
    );
  
    if (results.length > 0) {
      return results;
    }
  
    // 如果 Pinia 中没有找到匹配的结果，则从后端获取
    return accountAPI.searchAccounts(query).then(response => {
      const newResults = response.data;
  
      // 根据返回的数据更新 Pinia 中的 accounts
      newResults.forEach(newAccount => {
        const existingAccountIndex = store.accounts.findIndex(acc => acc.id === newAccount.id);
        if (existingAccountIndex !== -1) {
          // 如果 Pinia 中已有该账户，则更新
          store.accounts[existingAccountIndex] = newAccount;
        } else {
          // 如果 Pinia 中没有该账户，则添加
          store.accounts.push(newAccount);
        }
      });
  
      return newResults;
    }).catch(error => {
      console.error('Failed to search accounts:', error);
      throw error;
    });
  },

};

export default accountService;