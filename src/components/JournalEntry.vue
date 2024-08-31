<template>
  <div>
    <div class="container">
      <div class="left-panel no-print" @mouseenter="showPanel" @mouseleave="hidePanel" :style="{ left: panelLeft }">
        <div class="panel-toggle">{{ panelToggleText }}</div>
        <h2>已保存凭证</h2>
        <ul class="entries-list">
          <li v-for="entry in savedEntries" :key="entry.id">
            <div class="entry-date">{{ entry.voucherDate }}</div>
            <div class="entry-description">{{ entry.voucherType }}{{ entry.voucherNumber }} {{
              entry.entries[0].summary
            }}
            </div>
            <div class="entry-amount">合计：￥{{ entry.totalAmount.toFixed(2) }}</div>
          </li>
        </ul>
      </div>
      <div class="right-panel">
        <div class="voucher-container">
          <div class="title-container">
            <h1 class="main-title">记账凭证</h1>
            <span class="sub-title">2024年第12期</span>
          </div>

          <div class="header">
            <div class="header-left">
              <div class="header-item">
                凭证字
                <select v-model="journalEntryView.journalEntry.voucherWord">
                  <option value="记">记</option>
                  <!-- Add more options as needed -->
                </select>
              </div>
              <div class="header-item">
                <input type="text" v-model="journalEntryView.journalEntry.voucherNumber" style="width: 50px;">
                号
              </div>
            </div>
            <div class="header-right">
              <div class="header-item">
                日期
                <input
                  type="date"
                  v-model="journalEntryView.journalEntry.modifiedDate"
                  :max="maxDate"
                  @change="handleDateChange"
                >
              </div>
              <div class="header-item">
                附单据
                <input type="text" v-model="journalEntryView.journalEntry.attachmentIds.length" style="width: 50px;">
                张
              </div>
            </div>
          </div>
          <table>
            <colgroup>
              <col class="col-summary">
              <col class="col-account">
              <col class="col-debit">
              <col class="col-credit">
              <col class="col-action no-print">
            </colgroup>
            <tr>
              <th>摘要</th>
              <th>会计科目</th>
              <th>借方金额</th>
              <th>贷方金额</th>
              <th class="no-print">操作</th>
            </tr>
            <tbody ref="transactions">
              <tr v-for="(transaction, index) in journalEntryView.transactions" :key="index">
                <td :class="{ 'green-bg': index === 0 }" @click="editCell($event, transaction, 'description', index)">
                  <span>{{ transaction.description }}</span>
                  <input type="text" v-model="transaction.description" class="editable"
                    @blur="hideInput($event, transaction, 'description')"
                    @keydown="handleKeydown($event, transaction, 'description', index)" />
                </td>

                <td class="account" :data-index="index" @click="editCell($event, transaction, 'account', index)">

                  <el-autocomplete class="custom-autocomplete"
                    v-model="transaction.accountFullName"
                    value-key="fullName"
                    :fetch-suggestions="querySearch" placeholder="选择会计科目"
                    @select="(selectedAccount) => updateAccount(selectedAccount, transaction)"
                    @blur="handleInput(transaction)"
                    @keydown="handleKeydown($event, transaction, 'account', index)"
                     ref="autocompleteRef" 
                    :highlight-first-item=true
                    />
                </td>

                <td class="right-align bold-text number-cell" :data-index="index" data-field="debit"
                  @click="editCell($event, transaction, 'debit', index)">
                  <span>{{ formatNumber(transaction.debit) }}</span>
                  <input type="text" v-model.number="transaction.debit" class="editable"
                    @blur="hideInput($event, transaction, 'debit')"
                    @keydown="handleKeydown($event, transaction, 'debit', index)" />
                </td>
                <td class="right-align bold-text number-cell" :data-index="index" data-field="credit"
                  @click="editCell($event, transaction, 'credit', index)"><span>{{
                    formatNumber(transaction.credit)
                  }}</span>
                  <input type="text" v-model.number="transaction.credit" class="editable"
                    @blur="hideInput($event, transaction, 'credit')"
                    @keydown="handleKeydown($event, transaction, 'credit', index)" />
                </td>
                <td class="action-cell no-print">
                  <span class="action-icon add" @click="addRow(index)">+</span>
                  <span class="action-icon delete" @click="deleteRow(index)">-</span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="non-editable">
                <td colspan="2">合计：{{ totalAmountInWords }}</td>
                <td class="right-align bold-text number-cell">{{ formatNumber(totalDebit) }}</td>
                <td class="right-align bold-text number-cell">{{ formatNumber(totalCredit) }}</td>
                <td class="no-print"></td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <div class="preparer">
              制单人：<span>{{ journalEntryView.journalEntry.bookkeeper }}</span>
            </div>
            <div class="buttons">
              <button class="btn btn-save no-print" @click="saveJournalEntry">保存</button>
              <button class="btn btn-new no-print" @click="showNewVoucherConfirmation">新增</button>
              <button class="btn btn-print no-print" @click="printVoucher">打印</button>
              <!-- 添加新的按钮来触发模拟数据生成和发送 -->
              <button class="btn btn-mock no-print" @click="generateAndSendMockData">生成模拟数据</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal" v-if="showConfirmModal">
      <div class="modal-content">
        <p>是否保存当前凭证？</p>
        <div class="modal-buttons">
          <button class="modal-btn modal-btn-save" @click="saveAndCreateNew">保存</button>
          <button class="modal-btn modal-btn-discard" @click="discardAndCreateNew">不保存</button>
          <button class="modal-btn modal-btn-cancel" @click="cancelNewVoucher">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { Transaction, JournalEntryView } from '@/models/journalEntryModels.js'
import { journalEntryService } from '@/services/journalEntryService';
import { useAccountStore } from '@/stores/accountStore';
import { formatNumber, numberToChinese } from '@/utils.js'
import { ElMessage } from 'element-plus'

export default {
  components: {
  },

  data: () => ({
    panelLeft: '-270px',
    panelToggleText: '展开',
    savedEntries: [],
    showConfirmModal: false,
    // 初始化 journalEntryView 对象
    journalEntryView: {},

  }),
  computed: {
    totalDebit() {
      return this.journalEntryView.transactions.reduce((sum, transaction) => sum + parseFloat(transaction.debit), 0);
    },
    totalCredit() {
      return this.journalEntryView.transactions.reduce((sum, transaction) => sum + parseFloat(transaction.credit), 0);
    },
    totalAmountInWords() {
      // 实现金额转大写的逻辑
      return this.numberToChinese(this.totalDebit) + '元整';
    },

    getLeafAccountsWithFullName() {
      const accountStore = useAccountStore();
      return accountStore.getLeafAccountsWithFullName;
    },

    maxDate() {
      return new Date().toISOString().split('T')[0];
    }
  },
  methods: {
    showPanel() {
      this.panelLeft = '0';
      this.panelToggleText = '隐藏';
    },
    hidePanel() {
      this.panelLeft = '-270px';
      this.panelToggleText = '展开';
    },
    editCell(event, transaction, field, index) {
      const cell = event.currentTarget;
      const span = cell.querySelector('span');
      const input = cell.querySelector('input');
      if (span) {
        span.style.display = 'none';
      }
      if (input) {
        input.style.display = 'block';
        input.focus();
        input.select();
      }
      //copy the first transaction description
      if (field === 'description' && index > 0 && transaction?.description === '') {
        transaction.description = this.journalEntryView?.transactions[index - 1]?.description || '';
      }
      if (field === 'account') {
        const searchableSelectInput = cell.querySelector('.searchable-select input');
        if (searchableSelectInput) {
          searchableSelectInput.focus();
          searchableSelectInput.click();
        }
      }
    },

    hideInput(event, entry, field) {
      const input = event.target;
      const cell = input.closest('td');
      const span = cell.querySelector('span');
      if (input) {
        input.style.display = 'none';
      }
      if (span) {
        span.style.display = 'inline';
      }
      // 检查借方和贷方的值
      if (field === 'debit' && parseFloat(entry.debit) !== 0) {
        entry.credit = 0.0;
      } else if (field === 'credit' && parseFloat(entry.credit) !== 0) {
        entry.debit = 0.0;
      }
    },

    addRow(index) {
      this.journalEntryView.transactions.splice(index + 1, 0, new Transaction());
    },
    deleteRow(index) {
      if (this.journalEntryView.transactions.length > 1) {
        this.journalEntryView.transactions.splice(index, 1);
      } else {
        alert('Cannot delete the last row.');
      }
    },
    async saveJournalEntry() {
      // 1. 验证交易记录
      for (const transaction of this.journalEntryView.transactions) {
        if (!journalEntryService.isEmptyTransaction(transaction)) {
          if (!transaction?.accountId) {
            ElMessage.error('有交易没有会计科目或者会计科目无效。');
            return;
          }
          if (transaction.debit === 0 && transaction.credit === 0) {
            ElMessage.error('每条交易的借方或贷方必须有一方不为零。');
            return;
          }
        }
      }

      if (this.totalDebit !== this.totalCredit) {
        ElMessage.error('借贷方不相等');
        return;
      }

      // 2. 比较当前数据和原始数据
      if (journalEntryService.originalData && 
          journalEntryService.isJournalEntryUnchanged(journalEntryService.originalData, this.journalEntryView)) {
        ElMessage.info("分录未发生变化，无需保存");
        return;
      }

      // 3. 使用 service.js 保存到后端
      const response = await journalEntryService.saveJournalEntryView(this.journalEntryView);
      this.journalEntryView = Object.assign({}, response);

      // 4. 保存成功后，重新设置原始数据
      journalEntryService.setOriginalData(this.journalEntryView);

      console.log("保存成功，从后端返回的数据：", response);
      ElMessage.success("保存成功");
    },

    showNewVoucherConfirmation() {
      this.showConfirmModal = true;
    },
    saveAndCreateNew() {
      this.saveJournalEntry();
      this.createNewVoucher();
      this.showConfirmModal = false;
    },
    discardAndCreateNew() {
      this.createNewVoucher();
      this.showConfirmModal = false;
    },
    cancelNewVoucher() {
      this.showConfirmModal = false;
    },
    createNewVoucher() {
      this.journalEntryView = new JournalEntryView();
    },
    printVoucher() {
      window.print();
    },
    formatNumber, // Using the imported utility function
    numberToChinese, // Using the imported utility function
    // 处理选中事件，将选中的 account 对象传递给 transaction
    updateAccount(selectedAccount, transaction) {
      console.log("updateAccount");
      if(selectedAccount){
      transaction.accountId = selectedAccount.id;
      transaction.accountFullName = selectedAccount.fullName;
    }else{
      transaction.accountId = null;
    }
    },
    handleKeydown(event, transaction, field, index) {
      if (event.key !== 'Enter' && event.key !== 'Tab') return;
      event.preventDefault();
      const fieldsOrder = ['description', 'account', 'debit', 'credit'];
      if (field === 'account' && event.key === 'Enter') {
        const autocomplete = this.$refs.autocompleteRef[index];
        if (autocomplete.highlightedIndex === -1) {
          autocomplete.highlightedIndex = 0;
        }

        // Select the highlighted suggestion
        const selectedAccount = autocomplete.suggestions[autocomplete.highlightedIndex];
        this.updateAccount(selectedAccount, transaction);
      }

      if (fieldsOrder.indexOf(field) < fieldsOrder.length - 1) {
        this.$refs.transactions.querySelectorAll('tr')[index].querySelectorAll('td')[fieldsOrder.indexOf(field) + 1]?.click();
      } else {
        if (index + 1 >= this.journalEntryView.transactions.length) {
          if (event.key === 'Enter') {
            this.journalEntryView.transactions.push(new Transaction());
          } else {
            return;
          }
        }
        this.$nextTick(() => {
          this.$refs.transactions.querySelectorAll('tr')[index + 1].querySelectorAll('td')[0]?.click();
        })
      }
    },
    querySearch(queryString, cb) {
      const results = queryString
        ? this.getLeafAccountsWithFullName
          .filter(account => account.fullName.toLowerCase().includes(queryString.toLowerCase()))
        : this.getLeafAccountsWithFullName
      cb(results||[]); // 返回包含 value 和其他属性的对象数组
    },
    handleInput(transaction) {
      //if input is included in this.getLeafAccountsWithFullName, then update the transaction.accountFullName
      const account = this.getLeafAccountsWithFullName.find(account => account.id === transaction.accountId);
      if (account?.fullName!==transaction.accountFullName) {
        ElMessage.error('无效的科目！');
        transaction.accountId = null;
      }
    },
    // 添加新方法来生成和发送模拟数据
    async generateAndSendMockData() {
      try {
        const result = await journalEntryService.generateAndSendMockData();
        if (result) {
          ElMessage.success('模拟数据已成功生成并发送');
        } else {
          ElMessage.error('生成或发送模拟数据时出错');
        }
      } catch (error) {
        console.error('生成模拟数据时发生错误:', error);
        ElMessage.error('生成模拟数据时发生错误');
      }
    },

    handleDateChange(event) {
      // 如果需要，可以在这里添加额外的日期处理逻辑
      this.journalEntryView.journalEntry.modifiedDate = event.target.value;
    }
  },
  mounted() {
  },
  created() {
    const accountStore = useAccountStore();  // 获取 store 实例
    accountStore.fetchAccounts();
    this.journalEntryView = new JournalEntryView(); // 初始化 journalEntryView
    // 初始化时设置原始数据
    journalEntryService.setOriginalData(this.journalEntryView);
  }
}

</script>


<style scoped>
@import '@/assets/styles/journalEntry.css';

/* Target the deepest element with ::v-deep */
.custom-autocomplete {
  height: 100%;
  padding: 2px;
}

::v-deep(.custom-autocomplete .el-input) {
  height: 60px;
}

/* 为新按钮添加样式 */
.btn-mock {
  background-color: #8e44ad;
  color: white;
}

input[type="date"] {
  padding: 4px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  width: 130px;
}
</style>
