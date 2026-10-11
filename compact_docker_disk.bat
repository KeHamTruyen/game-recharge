@echo off
:: Script thu gọn dung lượng ổ đĩa ảo docker_data.vhdx để giải phóng dung lượng ổ C
title Thu gon dung luong Docker VHDX

echo ========================================================
echo   DANG THU GON O DIA AO DOCKER (GIAI PHONG O C)
echo ========================================================
echo.

echo 1. Dang dong Docker Desktop va tat WSL2...
taskkill /F /IM "Docker Desktop.exe" >nul 2>&1
taskkill /F /IM "com.docker.backend.exe" >nul 2>&1
wsl --shutdown

echo.
echo 2. Dang chay Diskpart compact cho docker_data.vhdx...
(
echo select vdisk file="C:\Users\Admin\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
echo attach vdisk readonly
echo compact vdisk
echo detach vdisk
) > "%TEMP%\compact_docker.txt"

diskpart /s "%TEMP%\compact_docker.txt"
del "%TEMP%\compact_docker.txt" >nul 2>&1

echo.
echo ========================================================
echo   HOAN TAT! DUNG LUONG O C DA DUOC THU HOI THANH CONG.
echo   Ban co the mo lai Docker Desktop binh thuong.
echo ========================================================
echo.
pause

