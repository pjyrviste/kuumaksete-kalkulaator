const productCheckboxes = document.querySelectorAll('input[name="product"]')
const priceSlider = document.getElementById('price')
const periodSelector = document.getElementById('period')
const paymentBox = document.getElementById('initial-payment')
let selectedProduct = document.querySelector('input[name="product"]:checked').value
let selectedPrice = priceSlider.value
let selectedPeriod = periodSelector.value
let selectedPayment = paymentBox.value

const openPopupButtons = document.querySelectorAll('[data-popup-target]')
const closePopupButtons = document.querySelectorAll('[data-close-button]')
const overlay = document.getElementById('overlay')

let results = {}
let rules = null

/* Main function */

async function main() {
  try {
    rules = await getData()
    initialSetup()
    reset()
    update()
  } catch (error) {
    handleErrors(error)
  }
}

main()

/* Functions */

// fetches json data from file
async function getData() {
  const response = await fetch('data.json')
  if (!response.ok) {
    throw new Error(`VIGA: ${response.status}`)
  }
  const data = await response.json()
  return data
}

// sets up event handlers
function initialSetup() {
  productCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('click', (event) => {
      [...productCheckboxes].map(product => product.checked = false)
      const clickedCheckbox = [...productCheckboxes].find(checkbox => checkbox === event.target)
      if (checkbox === clickedCheckbox) {
        checkbox.checked = true
        selectedProduct = event.target.value
        reset()
        update()
      }
    })
  })
  
  priceSlider.oninput = (event) => {
    if (event.target.value - selectedPayment >= getMinPrice()) {
      selectedPrice = event.target.value
    }
    setPeriodOptions()
    update()
  }
  
  periodSelector.onchange = (event) => {
    selectedPeriod = event.target.value
    update()
  }
  
  paymentBox.oninput = (event) => {
    if (event.target.value == '') {
      event.target.value = 0
    } else if (event.target.value >= 0 && (selectedPrice - 
        parseInt(event.target.value, 10)) >= getMinPrice()) {
      selectedPayment = parseInt(event.target.value, 10)
      priceSlider.min = getMinPrice() + parseInt(event.target.value, 10)
      document.getElementById('min-price').innerHTML = getMinPrice() + 
        parseInt(event.target.value, 10)
    }
    event.target.value = selectedPayment
    setPeriodOptions()
    update()
  }
  
  openPopupButtons.forEach(button => {
    button.addEventListener('click', () => {
      const popup = document.querySelector(button.dataset.popupTarget)
      openPopup(popup)
    })
  })
  
  closePopupButtons.forEach(button => {
    button.addEventListener('click', () => {
      const popup = button.closest('#popup')
      closePopup(popup)
    })
  })
  
  overlay.addEventListener('click', () => {
    const popups = document.querySelectorAll('#popup.active')
    popups.forEach(popup => {
      closePopup(popup)
    })
  })
}

// resets calculator state
function reset() {
  selectedPrice = getCurrentProductRule().defaultCredit
  priceSlider.value = selectedPrice
  selectedPayment = 0
  paymentBox.value = selectedPayment
  priceSlider.min = getMinPrice()
  document.getElementById('min-price').innerHTML = getMinPrice()
  priceSlider.max = getMaxPrice()
  document.getElementById('max-price').innerHTML = getMaxPrice()
  setPeriodOptions()
  selectedPeriod = getCurrentProductRule().defaultPeriod
  periodSelector.value = selectedPeriod
}

// calls for updated results and page rendering
function update() {
  calculateResults()
  displayResults()
}

// calculates results and updates the global results object
function calculateResults() {
  try {
    const product = getCurrentProductRule()
    results.initialCredit = (selectedPrice - selectedPayment)
    const rule = getCreditRule(product)
    results.interest = rule.interest
    results.contractFee = rule.contractFee
    results.managingFee = rule.managingFee
    results.totalPayable = getTotal()
    results.monthlyPayable = getMonthly(results.totalPayable, selectedPeriod)
  } catch (error) {
    handleErrors(error)
  }

  function getCreditRule(category) {
    return category.settings.find(element => element.minCredit <= results.initialCredit && 
      results.initialCredit <= element.maxCredit)
  }
  
  function getTotal() {
    return formatNumber(results.initialCredit * (1 + results.interest / 100) + 
      results.contractFee + (results.managingFee * selectedPeriod))
  }

  function getMonthly(total, months) {
    return formatNumber(total / months)
  }
}

// displays calculated results on the page
function displayResults() {
  document.getElementById('credit').innerHTML = `${results.initialCredit} EUR`
  document.getElementById('interest').innerHTML = `${results.interest.toFixed(2)} %`
  document.getElementById('contract-fee').innerHTML = `${results.contractFee} EUR`
  document.getElementById('managing-fee').innerHTML = `${results.managingFee} EUR`
  document.getElementById('total-payable').innerHTML = `${results.totalPayable} EUR`
  document.getElementById('monthly-payable').innerHTML = `${results.monthlyPayable} EUR`
  document.getElementById('current-price').innerHTML = `${selectedPrice} EUR`
}

// sets selected product to given product number
function setSelectedProduct(number) {
  selectedProduct = number
  productCheckboxes.forEach(checkbox => {
    if (number == checkbox.value) {
      checkbox.checked = true
    } else {
      checkbox.checked = false
    }
  })
}

// finds the right credit rule for currently selected product
function getCurrentProductRule() {
  return rules ? rules.find(rule => rule.id == selectedProduct) : null 
}

// number formatted to 2 decimal places
function formatNumber(number) {
  return number.toFixed(2)
}

// gets the default minimal price for currently selected product
function getMinPrice() {
  const { settings } = getCurrentProductRule()
  const prices = []
  settings.forEach((setting) => {
    prices.push(setting.minCredit)
  })
  return Math.min(...prices)
}

// gets the default maximal price for currently selected product
function getMaxPrice() {
  const { settings } = getCurrentProductRule()
  const prices = []
  settings.forEach((setting) => {
    prices.push(setting.maxCredit)
  })
  return Math.max(...prices)
}

// populates options for the period selector
function setPeriodOptions() {
  const [min, max] = getOptionLimits()
  periodSelector.innerHTML = ''
  for (let months = min; months <= max; months+=6) {
    periodSelector.add(new Option(`${months} kuud`, months))
  }
  periodSelector.value = selectedPeriod <= max ? selectedPeriod : getCurrentProductRule().defaultPeriod
  selectedPeriod = periodSelector.value
}

// returns default price slider boundaries for currently selected product
function getOptionLimits() {
  const { settings } = getCurrentProductRule()
  const rule = settings.find(element => element.minCredit <= (selectedPrice-selectedPayment) && 
    (selectedPrice-selectedPayment) <= element.maxCredit)
  return [rule.minPeriod, rule.maxPeriod]
}

// error handling
function handleErrors(error) {
  document.getElementById('root').innerHTML = '<p class="error">Midagi läks valesti.</p>'
  console.error('ERROR: ' + error)
  console.trace()
}

// shows the popup window
function openPopup(popup) {
  if (popup == null) {
    return
  }
  popup.classList.add('active')
  overlay.classList.add('active')
  document.querySelector('#root').classList.add('blurred')
}

// hides the popup window
function closePopup(popup) {
  if (popup == null) {
    return
  }
  popup.classList.remove('active')
  overlay.classList.remove('active')
  document.querySelector('#root').classList.remove('blurred')
  setSelectedProduct(1)
  reset()
  update()
}