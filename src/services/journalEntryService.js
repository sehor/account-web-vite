// service.js

import {JournalEntryModels, JournalEntryView, Transaction} from '@/models/journalEntryModels.js';
import {journalEntryApi} from '@/http/journalEntryAPI';
import {useAccountStore} from '@/stores/accountStore';
import {ElMessage} from 'element-plus';
import accountService from '@/services/accountService'
import { getAccountSetId } from '@/utils';
import { faker } from '@faker-js/faker/locale/zh_CN';
import axios from 'axios';

class JournalEntryService {
    constructor() {
        this.originalData = null;
    }

    // 确保这个方法被正确定义
    setOriginalData(journalEntryView) {
        this.originalData = this.cloneJournalEntryView(journalEntryView);
    }

    // 确保这个方法也被定义
    cloneJournalEntryView(journalEntryView) {
        return {
            journalEntry: { ...journalEntryView.journalEntry },
            transactions: journalEntryView.transactions.map(t => ({ ...t }))
        };
    }

    // 创建 JournalEntryView 对象并发送到后端
    async saveJournalEntryView(journalEntryView) {
        const transactions_filter = journalEntryView.transactions.filter(t => !this.isEmptyTransaction(t));

        if (transactions_filter.length < 2) {
            ElMessage.error("分录必须包含2条或以上交易记录");
            return;
        }

        const journalEntryView_toBackend = this.mapToJournalEntryView(journalEntryView.journalEntry, transactions_filter);

        // 比较当前数据和原始数据
        if (this.originalData && this.isJournalEntryUnchanged(this.originalData, journalEntryView_toBackend)) {
            ElMessage.info("分录未发生变化，无需保存");
            return this.originalData;
        }

        // 如果有变化，继续保存操作
        const response = await journalEntryApi.save(journalEntryView_toBackend);
        const mappedResponse = await this.mapFromBackend(response);
        
        // 更新原始数据
        this.setOriginalData(mappedResponse);
        
        return mappedResponse;
    }

    // 获取 JournalEntryView 对象
    async getJournalEntryView(id) {
        const response = await journalEntryApi.getJournalEntryView(id);
        return this.mapFromBackend(response);
    }

    // 更新 JournalEntryView 对象
    async updateJournalEntryView(journalEntryData, transactionsData) {
        const journalEntryView = this.mapToJournalEntryView(journalEntryData, transactionsData);
        const response = await journalEntryApi.updateJournalEntryView(journalEntryView);
        return this.mapFromBackend(response);
    }

    // 删除 JournalEntryView 对象
    async deleteJournalEntryView(id) {
        const response = await journalEntryApi.deleteJournalEntryView(id);
        return response;
    }

    // 将前端数据映射为 JournalEntryView 对象
    mapToJournalEntryView(journalEntryData, transactionsData) {
        // 使用 Object.assign 拷贝对象
        const journalEntry = Object.assign({}, journalEntryData);

        // 遍历 transactionsData，设置 balanceDirection
        const transactions = transactionsData.map(transaction => {
            const transactionCopy = Object.assign({}, transaction);
            transactionCopy.vounrchWord=journalEntry.vounrchWord;
            delete transactionCopy?.accountFullName;
            return transactionCopy;
        });

        return new JournalEntryView(journalEntry, transactions);
    }

    // 将后端传来的数据映射为 JournalEntryView 对象
    async mapFromBackend(data) {
        const journalEntry = new JournalEntryModels();
        Object.assign(journalEntry, data.journalEntry);

        // Get the Pinia store instance and the accounts with full names
        const accountStore = useAccountStore();
        const leafAccounts = accountStore.getLeafAccountsWithFullName;

        // Map the transactions and set the full name for the account
        const transactions = data.transactions.map(transactionData => {
            const transaction = new Transaction();
            Object.assign(transaction, transactionData);

            // Find the account using the account ID and set the full name
            const account = leafAccounts.find(acc => acc.id === transactionData.accountId);

            if (account) {
                transaction.accountFullName = account.fullName; // Ensure the fullName is set
            } else {
                // If the account is not found, you can handle it appropriately
                console.warn(`Account with ID ${transactionData.accountId} not found.`);
            }

            return transaction;
        });

        // Fill in the remaining slots with empty transactions
        for (let i = 5 - transactions.length; i > 0; i--) {
            transactions.push(new Transaction());
        }

        return new JournalEntryView(journalEntry, transactions);
    }

    // 新增方法：比较两个 JournalEntryView 对象
    isJournalEntryUnchanged(original, current) {
        // 比较 journalEntry 属性
        const journalEntryUnchanged = 
            original.journalEntry.voucherWord === current.journalEntry.voucherWord &&
            original.journalEntry.voucherNumber === current.journalEntry.voucherNumber &&
            original.journalEntry.modifiedDate === current.journalEntry.modifiedDate;

        // 比较 transactions
        const transactionsUnchanged = original.transactions.length === current.transactions.length &&
            original.transactions.every((transaction, index) => 
                this.isTransactionUnchanged(transaction, current.transactions[index])
            );

        return journalEntryUnchanged && transactionsUnchanged;
    }

    // 新增方法：比较两个 Transaction 对象
    isTransactionUnchanged(original, current) {
        return original?.accountId === current?.accountId &&
               original.description === current.description &&
               original.debit === current.debit &&
               original.credit === current.credit;
    }

    isEmptyTransaction(transaction) {
        const hasNoAccount = !transaction.accountId;
        const debitIsZero = parseFloat(transaction.debit) === 0 || isNaN(parseFloat(transaction.debit));
        const creditIsZero = parseFloat(transaction.credit) === 0 || isNaN(parseFloat(transaction.credit));

        return hasNoAccount && debitIsZero && creditIsZero;
    }

    // 新增方法：生成并发送模拟数据
    async generateAndSendMockData() {
        const mockData = [];
        const accountStore = useAccountStore();
        const leafAccounts = accountStore.getLeafAccountsWithFullName;
        const accountSetId = getAccountSetId();

        // 定义账户类型和对应的摘要
        const accountSummaries = {
            '库存现金': ['支付现金', '收到现金'],
            '银行存款': ['支付转账', '收到转账'],
            '应收账款': ['确认应收账款', '收回应收账款'],
            '预付账款': ['预付款项', '结算预付款'],
            '应付账款': ['确认应付账款', '支付应付账款'],
            '预收账款': ['预收款项', '结算预收款'],
            '应付职工薪酬': ['计提工资', '发放工资'],
            '应交税费': ['计提税费', '缴纳税费'],
            '其他应收款': ['其他应收发生', '收回其他应收'],
            '其他应付款': ['其他应付发生', '支付其他应付'],
            '原材料': ['采购原材料', '领用原材料'],
            '库存商品': ['商品入库', '商品出库'],
            '固定资产': ['购置固定资产', '处置固定资产'],
            '累计折旧': ['计提折旧'],
            '长期待摊费用': ['新增长期待摊', '摊销费用'],
            '主营业务收入': ['确认销售收入'],
            '其他业务收入': ['确认其他收入'],
            '主营业务成本': ['结转销售成本'],
            '其他业务成本': ['结转其他成本'],
            '管理费用': ['发生管理费用'],
            '销售费用': ['发生销售费用'],
            '财务费用': ['发生财务费用'],
            '营业外收入': ['确认营业外收入'],
            '营业外支出': ['发生营业外支出']
        };

        // 辅助函数：根据账户名称获取合适的摘要
        function getSummaryForAccount(accountName) {
            for (const [key, summaries] of Object.entries(accountSummaries)) {
                if (accountName.includes(key)) {
                    return faker.helpers.arrayElement(summaries);
                }
            }
            return "其他业务";
        }

        for (let i = 0; i < 10; i++) {
            const journalEntry = new JournalEntryModels(
                null,
                faker.date.recent().toISOString(),
                faker.date.recent().toISOString(),
                '记',
                faker.person.fullName(),
                faker.person.fullName(),
                faker.person.fullName(),
                [],
                i + 1,
                [],
                accountSetId
            );

            const amount = parseFloat(faker.finance.amount({ min: 1, max: 10000, dec: 2 }));
            const debitAccount = faker.helpers.arrayElement(leafAccounts);
            const creditAccount = faker.helpers.arrayElement(leafAccounts.filter(a => a.id !== debitAccount.id));

            // 使用 AI 生成摘要
            const summary = await this.getAIGeneratedSummary(debitAccount.fullName, creditAccount.fullName);

            const transactions = [
                new Transaction(
                    null,
                    faker.date.recent().toISOString(),
                    faker.date.recent().toISOString(),
                    summary,
                    debitAccount.id,
                    debitAccount.fullName,
                    amount,
                    0,
                    '记',
                    accountSetId
                ),
                new Transaction(
                    null,
                    faker.date.recent().toISOString(),
                    faker.date.recent().toISOString(),
                    summary,
                    creditAccount.id,
                    creditAccount.fullName,
                    0,
                    amount,
                    '记',
                    accountSetId
                )
            ];

            const journalEntryView = new JournalEntryView(journalEntry, transactions);
            mockData.push(journalEntryView);
        }

        // 模拟发送数据到后端
        try {
            for (const data of mockData) {
                const response = await this.saveJournalEntryView(data);
                console.log('模拟数据已发送:', response);
            }
            console.log('所有模拟数据已成功发送');
            return true;
        } catch (error) {
            console.error('发送模拟数据时出错:', error);
            return false;
        }
    }

    async getAIGeneratedSummary(debitAccount, creditAccount) {
        try {
            const response = await axios.post('/api/generate-summary', {
                debitAccount,
                creditAccount
            });
            return response.data.summary;
        } catch (error) {
            console.error('获取 AI 生成的摘要时出错:', error);
            return '其他业务';
        }
    }
}

export const journalEntryService = new JournalEntryService();
