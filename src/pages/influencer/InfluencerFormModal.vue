<template>
  <a-modal :open="visible" :title="record ? '编辑红人' : '新建红人'"
    width="960px" :destroy-on-close="true" :confirm-loading="saving"
    @ok="handleSave" @cancel="emit('update:visible', false)">
    <a-form ref="formRef" :model="form" :label-col="{ span: 8 }" :wrapper-col="{ span: 14 }" size="middle">
      <a-row :gutter="24">
        <!-- 左列 -->
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">基本信息</a-divider>

          <a-form-item label="红人类型" name="influencerType"
            :rules="[{ required: true, message: '请选择红人类型' }]">
            <a-select v-model:value="form.influencerType">
              <a-select-option v-for="o in getOptions('influencer_type')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="红人ID" name="accountName"
            :rules="[{ required: true, message: '请填写红人ID' }]">
            <a-input v-model:value="form.accountName" />
          </a-form-item>

          <a-form-item label="红人团队">
            <a-select v-model:value="form.teamName" allow-clear show-search
              :filter-option="(input, opt) => opt.value.includes(input)"
              placeholder="选择或搜索团队">
              <a-select-option v-for="t in teams" :key="t.name" :value="t.name">
                {{ t.name }}
              </a-select-option>
            </a-select>
            <a-input-search v-if="authStore.canWrite" v-model:value="newTeamName"
              placeholder="输入新团队名称后回车添加"
              enter-button="添加团队" style="margin-top:6px"
              @search="handleAddTeam" />
          </a-form-item>

          <a-form-item label="品牌方">
            <a-select v-model:value="form.brandId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)">
              <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">
                {{ b.name }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="服务国家/市场">
            <a-select v-model:value="form.countryMarket" show-search allow-clear
              :filter-option="(input, opt) => opt.value.includes(input)">
              <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="平台">
            <a-select v-model:value="form.platform" allow-clear>
              <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="所属领域">
            <a-select v-model:value="form.domains" mode="multiple" allow-clear>
              <a-select-option v-for="d in domains" :key="d.name" :value="d.name">
                {{ d.name }}
              </a-select-option>
            </a-select>
            <a-input-search v-if="authStore.canWrite" v-model:value="newDomainName"
              placeholder="输入新领域名称后回车添加"
              enter-button="添加领域" style="margin-top:6px"
              @search="handleAddDomain" />
          </a-form-item>

          <a-form-item label="粉丝量">
            <a-input-number v-model:value="form.followerCount" style="width:100%"
              :min="0" :formatter="v => v ? Number(v).toLocaleString() : ''"
              :parser="v => v.replace(/,/g, '')" />
          </a-form-item>

          <a-form-item label="建联情况">
            <a-select v-model:value="form.contactStatus" allow-clear>
              <a-select-option v-for="o in getOptions('contact_status')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="付款周期">
            <a-select v-model:value="form.paymentCycle" allow-clear>
              <a-select-option v-for="o in getOptions('payment_cycle')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="跟进人">
            <a-select v-model:value="form.followerPerson" allow-clear show-search
              :filter-option="(input, opt) => opt.value.includes(input)">
              <a-select-option v-for="emp in employees" :key="emp.id" :value="emp.name">
                {{ emp.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <!-- 右列 -->
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">联系方式</a-divider>

          <a-form-item label="红人邮箱">
            <a-input v-model:value="form.email" />
          </a-form-item>
          <a-form-item label="红人电话">
            <a-input v-model:value="form.contacts.phone" placeholder="+1 234 567 8900" />
          </a-form-item>
          <a-form-item label="红人WhatsApp">
            <a-input v-model:value="form.contacts.whatsapp" placeholder="+1 234 567 8900" />
          </a-form-item>
          <a-form-item label="红人Line">
            <a-input v-model:value="form.contacts.line" placeholder="Line ID" />
          </a-form-item>
          <a-form-item label="红人Telegram">
            <a-input v-model:value="form.contacts.telegram" placeholder="@telegram_xxx" />
          </a-form-item>

          <a-divider orientation="left" style="font-size:13px">链接 & 合同</a-divider>

          <a-form-item label="主页链接">
            <div v-for="(link, idx) in form.links" :key="'link-' + idx"
              style="display:flex;gap:8px;margin-bottom:6px">
              <a-input v-model:value="form.links[idx]" placeholder="https://..." style="flex:1" />
              <a-button danger size="small" @click="form.links.splice(idx, 1)">删除</a-button>
            </div>
            <a-button type="dashed" size="small" @click="form.links.push('')">+ 添加链接</a-button>
          </a-form-item>

          <a-form-item label="合作案例链接">
            <div v-for="(link, idx) in form.casesLinks" :key="'case-' + idx"
              style="display:flex;gap:8px;margin-bottom:6px">
              <a-input v-model:value="form.casesLinks[idx]" placeholder="https://..." style="flex:1" />
              <a-button danger size="small" @click="form.casesLinks.splice(idx, 1)">删除</a-button>
            </div>
            <a-button type="dashed" size="small" @click="form.casesLinks.push('')">+ 添加案例链接</a-button>
          </a-form-item>

          <a-form-item label="已签署合同">
            <a-input v-model:value="form.contractLink" placeholder="粘贴 Google Drive 链接" />
            <div style="margin-top:4px">
              <a v-if="contractUploadUrl" :href="contractUploadUrl" target="_blank">
                跳转至合同上传页面 ↗
              </a>
              <span v-else style="color:#bbb;font-size:12px">合同上传页面暂未配置</span>
            </div>
          </a-form-item>

          <!-- 敏感字段 -->
          <template v-if="canViewFinancials">
            <a-divider orientation="left" style="font-size:13px">财务信息</a-divider>
            <a-form-item label="红人成本（美金）">
              <a-input v-model:value="form.influencerCost" placeholder="金额或备注" />
              <div v-if="isRemark(form.influencerCost)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>
            <a-form-item label="客户合作价格（美金）">
              <a-input v-model:value="form.clientPrice" placeholder="金额或备注" />
              <div v-if="isRemark(form.clientPrice)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>
          </template>

          <a-divider orientation="left" style="font-size:13px">其他</a-divider>
          <a-form-item label="备注">
            <a-textarea v-model:value="form.notes" :rows="3" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { influencerApi, employeeApi, domainApi, influencerTeamApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'

const props = defineProps({
  visible:           Boolean,
  record:            Object,
  canViewFinancials: { type: Boolean, default: false },
  brands:            { type: Array, default: () => [] },
  domains:           { type: Array, default: () => [] },
  teams:             { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved', 'domain-added', 'team-added'])

const formRef          = ref()
const saving           = ref(false)
const employees        = ref([])
const contractUploadUrl = ref('')
const newDomainName    = ref('')
const newTeamName      = ref('')
const authStore        = useAuthStore()
const { getOptions }   = useOptions()

const EMPTY_CONTACTS = () => ({ phone: '', whatsapp: '', line: '', telegram: '' })

const form = reactive({
  id: null,
  influencerType: 'OVERSEAS_INFLUENCER',
  teamName: '', accountName: '',
  brandId: null, countryMarket: null, platform: null,
  domains: [],
  followerCount: null, links: [], casesLinks: [],
  contractLink: '',
  email: '',
  contacts: EMPTY_CONTACTS(),
  contactStatus: 'UNDEVELOPED', paymentCycle: null,
  followerPerson: null,
  influencerCost: '', clientPrice: '', notes: ''
})

const CHINA_DEFAULT_DOMAINS = ['科技', '童装', '玩具', 'AI素材']

// 当红人类型切换为中国红人时，自动补齐默认领域
watch(() => form.influencerType, (newType) => {
  if (newType === 'CHINA_INFLUENCER') {
    const current = new Set(form.domains)
    CHINA_DEFAULT_DOMAINS.forEach(d => current.add(d))
    form.domains = Array.from(current)
  }
})
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}

function contactsToObj(json) {
  const obj = EMPTY_CONTACTS()
  if (!json) return obj
  try {
    const arr = JSON.parse(json)
    arr.forEach(item => { if (item.type && obj.hasOwnProperty(item.type)) obj[item.type] = item.value })
  } catch {}
  return obj
}

function contactsToJson(obj) {
  const arr = []
  if (obj.phone)    arr.push({ type: 'phone',    value: obj.phone })
  if (obj.whatsapp) arr.push({ type: 'whatsapp', value: obj.whatsapp })
  if (obj.line)     arr.push({ type: 'line',     value: obj.line })
  if (obj.telegram) arr.push({ type: 'telegram', value: obj.telegram })
  return arr.length > 0 ? JSON.stringify(arr) : null
}

watch(() => props.record, rec => {
  if (rec) {
    Object.assign(form, {
      id:             rec.id,
      influencerType: rec.influencerType || 'OVERSEAS_INFLUENCER',
      teamName:       rec.teamName       || '',
      accountName:    rec.accountName    || '',
      brandId:        rec.brandId        || null,
      countryMarket:  rec.countryMarket  || null,
      platform:       rec.platform       || null,
      domains:        (() => {
        const dList = splitMulti(rec.domains)
        if (rec.influencerType === 'CHINA_INFLUENCER') {
          const dSet = new Set(dList)
          CHINA_DEFAULT_DOMAINS.forEach(d => dSet.add(d))
          return Array.from(dSet)
        }
        return dList
      })(),
      followerCount:  rec.followerCount  || null,
      links:          splitMulti(rec.links),
      casesLinks:     splitMulti(rec.casesLinks),
      contractLink:   rec.contractLink   || '',
      email:          rec.email          || '',
      contacts:       contactsToObj(rec.contacts),
      contactStatus:  rec.contactStatus  || 'UNDEVELOPED',
      paymentCycle:   rec.paymentCycle   || null,
      followerPerson: rec.followerPerson || null,
      influencerCost: rec.influencerCost || '',
      clientPrice:    rec.clientPrice    || '',
      notes:          rec.notes          || ''
    })
  } else {
    Object.assign(form, {
      id:null, influencerType:'OVERSEAS_INFLUENCER', teamName:'', accountName:'',
      brandId:null, countryMarket:null, platform:null, domains:[],
      followerCount:null, links:[], casesLinks:[], contractLink:'',
      email:'', contacts:EMPTY_CONTACTS(),
      contactStatus:'UNDEVELOPED', paymentCycle:null, followerPerson:null,
      influencerCost:'', clientPrice:'', notes:''
    })
  }
}, { immediate: true })

async function handleAddDomain() {
  if (!newDomainName.value.trim()) return
  try {
    await domainApi.add(newDomainName.value.trim())
    message.success('领域添加成功')
    newDomainName.value = ''
    emit('domain-added')
  } catch (e) {
    message.error(e?.response?.data?.message || '添加失败')
  }
}

async function handleAddTeam() {
  if (!newTeamName.value.trim()) return
  try {
    await influencerTeamApi.add(newTeamName.value.trim())
    message.success('团队添加成功')
    form.teamName = newTeamName.value.trim()  // 自动选中刚添加的团队
    newTeamName.value = ''
    emit('team-added')
  } catch (e) {
    message.error(e?.response?.data?.message || '添加失败')
  }
}

function isRemark(value) {
  if (!value || !value.trim()) return false
  return isNaN(parseFloat(value.trim()))
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await influencerApi.save({
      id:             form.id,
      influencerType: form.influencerType,
      teamName:       form.teamName || null,
      accountName:    form.accountName,
      brandId:        form.brandId,
      countryMarket:  form.countryMarket,
      platform:       form.platform,
      domains:        form.domains,
      followerCount:  form.followerCount,
      links:          form.links.filter(l => l.includes('http')),
      casesLinks:     form.casesLinks.filter(l => l.includes('http')),
      contractLink:   form.contractLink || null,
      email:          form.email,
      contacts:       contactsToJson(form.contacts),
      contactStatus:  form.contactStatus,
      paymentCycle:   form.paymentCycle,
      followerPerson: form.followerPerson,
      influencerCost: form.influencerCost,
      clientPrice:    form.clientPrice,
      notes:          form.notes
    })
    message.success(form.id ? '更新成功' : '创建成功')
    emit('update:visible', false)
    emit('saved')
  } finally { saving.value = false }
}

onMounted(async () => {
  const [empRes, urlRes] = await Promise.all([
    employeeApi.list(),
    influencerApi.contractUploadUrl()
  ])
  employees.value      = empRes.data || []
  contractUploadUrl.value = urlRes.data || ''
})
</script>
