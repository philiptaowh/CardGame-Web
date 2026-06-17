# 运行测试并保存结果到文件

echo "运行测试..."
npm run test 2>&1 | tee test-results/test-output.txt

echo ""
echo "✅ 测试结果已保存到 test-results/test-output.txt"
echo "📄 查看详细输出:"
echo "   cat test-results/test-output.txt"
echo ""
echo "📊 测试统计:"
grep -E "^.*Test Files|^.*Tests" test-results/test-output.txt || true