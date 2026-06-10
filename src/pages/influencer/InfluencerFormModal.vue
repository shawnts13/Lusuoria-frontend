<template>
  <a-modal :open="visible" :title="record ? '编辑红人' : '新建红人'"
    width="900px" :destroy-on-close="true" :confirm-loading="saving"
    @ok="handleSave" @cancel="emit('update:visible', false)">
    <a-form ref="formRef" :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }" size="middle">
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
            <a-input v-model:value="form.accountName" placeholder="唯一标识，如 bigdogtech" />
          </a-form-item>

          <a-form-item label="红人团队">
            <div v-for="(t, idx) in form.teamNames" :key="idx"
              style="display:flex;gap:8px;margin-bottom:6px">
              <a-input v-model:value="form.teamNames[idx]" placeholder="团队/机构名称" style="flex:1" />
              <a-button danger size="small" @click="form.teamNames.splice(idx, 1)">删除</a-button>
            </div>
            <a-button type="dashed" size="small" @click="form.teamNames.push('')">+ 添加团队</a-button>
          </a-form-item>

          <a-form-item label="国家/市场">
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

          <a-form-item label="领域">
            <a-select v-model:value="form.domain" allow-clear>
              <a-select-option v-for="o in getOptions('domain')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="粉丝量">
            <a-input-number v-model:value="form.followerCount" style="width:100%"
              :min="0" :formatter="v => v ? Number(v).toLocaleString() : ''"
              :parser="v => v.replace(/,/g, '')" />
          </a-form-item>

          <a-form-item label="红人邮箱">
            <a-input v-model:value="form.email" />
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
              placeholder="选择员工" :filter-option="(input, opt) => opt.value.includes(input)">
              <a-select-option v-for="emp in employees" :key="emp.id"
                :value="emp.name">{{ emp.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <!-- 右列 -->
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">链接 & 案例</a-divider>

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

          <template v-if="canViewFinancials">
            <a-divider orientation="left" style="font-size:13px">财务信息</a-divider>

            <a-form-item label="红人成本（美金）">
              <a-input v-model:value="form.influencerCost"
                placeholder="金额如 500，或备注如：价格待定" />
              <div v-if="isRemark(form.influencerCost)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>

            <a-form-item label="客户合作价格（美金）">
              <a-input v-model:value="form.clientPrice"
                placeholder="金额如 1000，或备注如：价格待定" />
              <div v-if="isRemark(form.clientPrice)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>
          </template>

          <a-divider orientation="left" style="font-size:13px">其他</a-divider>
          <a-form-item label="备注">
            <a-textarea v-model:value="form.notes" :rows="4" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { influencerApi, employeeApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'

const props = defineProps({
  visible:           Boolean,
  record:            Object,
  canViewFinancials: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const formRef   = ref()
const saving    = ref(false)
const employees = ref([])
const { getOptions } = useOptions()

onMounted(async () => {
  const res = await employeeApi.list()
  employees.value = res.data || []
})

const form = reactive({
  id: null,
  influencerType: 'OVERSEAS_INFLUENCER',
  teamNames: [], accountName: '',
  countryMarket: null, platform: null, domain: null,
  followerCount: null, links: [], casesLinks: [],
  email: '', contactStatus: 'NONE', paymentCycle: null,
  followerPerson: '', influencerCost: '', clientPrice: '', notes: ''
})

// 兼容逗号或换行分隔
function splitMulti(str) {
  if (!str) return []
  return str.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
}

watch(() => props.record, rec => {
  if (rec) {
    Object.assign(form, {
      id:             rec.id,
      influencerType: rec.influencerType || 'OVERSEAS_INFLUENCER',
      teamNames:      splitMulti(rec.teamNames),
      accountName:    rec.accountName    || '',
      countryMarket:  rec.countryMarket  || null,
      platform:       rec.platform       || null,
      domain:         rec.domain         || null,
      followerCount:  rec.followerCount  || null,
      links:          splitMulti(rec.links),
      casesLinks:     splitMulti(rec.casesLinks),
      email:          rec.email          || '',
      contactStatus:  rec.contactStatus  || 'UNDEVELOPED',
      paymentCycle:   rec.paymentCycle   || null,
      followerPerson: rec.followerPerson || '',
      influencerCost: rec.influencerCost || '',
      clientPrice:    rec.clientPrice    || '',
      notes:          rec.notes          || ''
    })
  } else {
    Object.assign(form, {
      id:null, influencerType:'OVERSEAS_INFLUENCER', teamNames:[],
      accountName:'', countryMarket:null, platform:null, domain:null,
      followerCount:null, links:[], casesLinks:[],
      email:'', contactStatus:'UNDEVELOPED', paymentCycle:null,
      followerPerson:'', influencerCost:'', clientPrice:'', notes:''
    })
  }
}, { immediate: true })

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
      teamNames:      form.teamNames.filter(t => t.trim()),
      accountName:    form.accountName,
      countryMarket:  form.countryMarket,
      platform:       form.platform,
      domain:         form.domain,
      followerCount:  form.followerCount,
      links:          form.links.filter(l => l.includes('http')),
      casesLinks:     form.casesLinks.filter(l => l.includes('http')),
      email:          form.email,
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
</script>
