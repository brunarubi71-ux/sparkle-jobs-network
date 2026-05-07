@echo off
chcp 65001 >nul
echo.
echo ================================================
echo   SHINELY - Preparar projeto para Android Studio
echo ================================================
echo.

:: Verificar se Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado no seu computador.
    echo.
    echo Por favor, siga os passos abaixo:
    echo  1. Abra o navegador e acesse: https://nodejs.org
    echo  2. Clique no botao verde "LTS" para baixar
    echo  3. Instale o programa ^(clique em Next, Next, Install^)
    echo  4. REINICIE o computador depois de instalar
    echo  5. Clique duas vezes neste arquivo novamente
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado!
echo.

:: Ir para a pasta raiz do projeto (um nivel acima desta pasta)
cd /d "%~dp0"

echo [1/3] Instalando dependencias do projeto...
echo       ^(Isso pode demorar 2-3 minutos na primeira vez^)
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao instalar dependencias.
    echo       Verifique sua conexao com a internet e tente novamente.
    pause
    exit /b 1
)

echo.
echo [2/3] Sincronizando projeto Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao sincronizar o projeto Android.
    pause
    exit /b 1
)

echo.
echo [3/3] Pronto!
echo.
echo ================================================
echo   SUCESSO! Agora siga os passos abaixo:
echo ================================================
echo.
echo  1. Abra o Android Studio
echo  2. Clique em File ^> Open...
echo  3. Navegue ate esta pasta e abra a subpasta "android"
echo  4. Aguarde o Android Studio carregar ^(5-10 min^)
echo  5. Quando terminar: Build ^> Generate Signed Bundle / APK
echo.
pause
