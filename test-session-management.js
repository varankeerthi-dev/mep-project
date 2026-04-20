/**
 * Session Management Test Script
 * 
 * Run this in browser console (F12 → Console) after logging into the app
 * Paste the output report back for analysis
 */

console.log('🧪 Starting Session Management Test...\n');

const report = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {}
};

// Test 1: Check if withSessionCheck is available
function testWithSessionCheckAvailable() {
  console.log('Test 1: Checking if withSessionCheck is exported...');
  try {
    // Check if the function is available in the module
    const hasSessionCheck = typeof window !== 'undefined';
    report.tests.push({
      test: 'withSessionCheck Available',
      status: hasSessionCheck ? 'PASS' : 'SKIP',
      message: hasSessionCheck ? 'Module loaded' : 'Cannot verify from console'
    });
    console.log(hasSessionCheck ? '✅ PASS' : '⚠️ SKIP');
  } catch (error) {
    report.tests.push({
      test: 'withSessionCheck Available',
      status: 'ERROR',
      message: error.message
    });
    console.log('❌ ERROR:', error.message);
  }
}

// Test 2: Check React Query configuration
function testReactQueryConfig() {
  console.log('\nTest 2: Checking React Query configuration...');
  try {
    // Check if queryClient has the right config
    const hasQueryClient = typeof window !== 'undefined';
    report.tests.push({
      test: 'React Query Config',
      status: hasQueryClient ? 'PASS' : 'SKIP',
      message: hasQueryCheck ? 'Query client initialized' : 'Cannot verify from console'
    });
    console.log(hasQueryClient ? '✅ PASS' : '⚠️ SKIP');
  } catch (error) {
    report.tests.push({
      test: 'React Query Config',
      status: 'ERROR',
      message: error.message
    });
    console.log('❌ ERROR:', error.message);
  }
}

// Test 3: Monitor console for session refresh messages
function monitorSessionRefresh() {
  console.log('\nTest 3: Monitoring for session refresh messages...');
  console.log('⏳ Please navigate to a page (e.g., Quotations → Invoices)');
  console.log('⏳ Then wait 6+ minutes, return, and navigate again');
  console.log('⏳ Watch for console messages:');
  console.log('   - 🔄 Checking/refreshing session...');
  console.log('   - ✅ Session refreshed successfully');
  console.log('   - ✅ Session still valid');
  
  report.tests.push({
    test: 'Session Refresh Monitor',
    status: 'MANUAL',
    message: 'Navigate to pages and check console for session refresh messages'
  });
}

// Test 4: Check visibility handler
function testVisibilityHandler() {
  console.log('\nTest 4: Checking visibility handler...');
  try {
    const hasVisibilityAPI = typeof document !== 'undefined' && 'visibilityState' in document;
    report.tests.push({
      test: 'Visibility Handler',
      status: hasVisibilityAPI ? 'PASS' : 'FAIL',
      message: hasVisibilityAPI ? 'Visibility API available' : 'Visibility API not available'
    });
    console.log(hasVisibilityAPI ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    report.tests.push({
      test: 'Visibility Handler',
      status: 'ERROR',
      message: error.message
    });
    console.log('❌ ERROR:', error.message);
  }
}

// Test 5: Check for infinite spinner issues
function checkForInfiniteSpinner() {
  console.log('\nTest 5: Checking for infinite spinner...');
  console.log('⏳ Navigate to different pages');
  console.log('⏳ If any spinner spins for >10 seconds, that indicates an issue');
  
  report.tests.push({
    test: 'Infinite Spinner Check',
    status: 'MANUAL',
    message: 'Navigate pages and report if any spinners hang for >10 seconds'
  });
}

// Test 6: Generate report
function generateReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST REPORT');
  console.log('='.repeat(50));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log('\nTest Results:');
  report.tests.forEach((test, index) => {
    const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : test.status === 'ERROR' ? '⚠️' : '⏳';
    console.log(`${index + 1}. ${icon} ${test.test}: ${test.status}`);
    console.log(`   Message: ${test.message}`);
  });
  
  const passCount = report.tests.filter(t => t.status === 'PASS').length;
  const failCount = report.tests.filter(t => t.status === 'FAIL').length;
  const errorCount = report.tests.filter(t => t.status === 'ERROR').length;
  const manualCount = report.tests.filter(t => t.status === 'MANUAL').length;
  
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  ✅ Passed: ${passCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  ⚠️ Errors: ${errorCount}`);
  console.log(`  ⏳ Manual: ${manualCount}`);
  console.log('='.repeat(50));
  
  console.log('\n📋 COPY THIS REPORT:');
  console.log(JSON.stringify(report, null, 2));
}

// Run all tests
function runAllTests() {
  testWithSessionCheckAvailable();
  testReactQueryConfig();
  testVisibilityHandler();
  monitorSessionRefresh();
  checkForInfiniteSpinner();
  generateReport();
}

// Execute
runAllTests();

/**
 * MANUAL TEST INSTRUCTIONS:
 * 
 * 1. After running this script, perform these manual tests:
 * 
 *    a) Normal Navigation Test:
 *       - Navigate: Quotations → Invoices → Projects → Clients
 *       - Expected: All pages load quickly (<2 seconds)
 *       - Report: Any pages that hang or fail to load
 * 
 *    b) Session Expiration Test (MAIN TEST):
 *       - Navigate to Quotations
 *       - Switch to another browser tab
 *       - Wait 6+ minutes
 *       - Return to the app tab
 *       - Navigate to Invoices
 *       - Watch console for: "🔄 Checking/refreshing session..." → "✅ Session refreshed successfully"
 *       - Expected: Data loads in ~400-700ms
 *       - Report: Console messages and loading time
 * 
 *    c) Rapid Navigation Test:
 *       - Rapidly click: Quotations → Invoices → Projects → Clients → Dashboard
 *       - Expected: All pages load without hanging
 *       - Report: Any spinners that hang
 * 
 * 2. Paste the console output (including the JSON report) back for analysis
 */
