@echo off
chcp 65001 >nul
echo ============================================
echo  把部署公钥写入服务器 115.159.95.183
echo  提示：下面会要求输入服务器密码（输入时屏幕不显示，输完回车）
echo ============================================
echo.
ssh root@115.159.95.183 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHUOJljP/ViS5bfqEUPNzPx8kR929up06zHFh+qubX1C fridge-deploy' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo '公钥已写入服务器 ✓'"
echo.
echo 如果上面显示"公钥已写入服务器 ✓"即成功，可以关闭本窗口。
pause
