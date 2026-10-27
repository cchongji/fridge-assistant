<script>
export default {
  onLaunch() {
    // 无论开发还是生产，未登录一律停在登录页（登录页自身会检查 token 并放行）
    const token = uni.getStorageSync('token')
    if (token) return
    // #ifdef H5
    const path = location.pathname + location.hash
    if (!path.includes('pages/login')) {
      uni.reLaunch({ url: '/pages/login/index' })
    }
    // #endif
    // #ifndef H5
    uni.reLaunch({ url: '/pages/login/index' })
    // #endif
  }
}
</script>

<style>
page {
  background-color: #f6f8f7;
  font-family: 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  color: #1f2d2b;
}
</style>
