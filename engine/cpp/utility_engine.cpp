#include <iostream>
#include <string>
#include <cstdlib>
#include <cmath>

int main(int argc, char** argv) {
    if (argc != 4) {
        std::cerr << "Usage: asmer-utility <add|subtract|multiply|divide> <number> <number>\n";
        return 2;
    }
    const std::string operation = argv[1];
    char* endA = nullptr;
    char* endB = nullptr;
    const double a = std::strtod(argv[2], &endA);
    const double b = std::strtod(argv[3], &endB);
    if (!endA || *endA != '\0' || !endB || *endB != '\0' || !std::isfinite(a) || !std::isfinite(b)) {
        std::cerr << "Please provide two finite numbers.\n";
        return 2;
    }
    double result = 0;
    if (operation == "add") result = a + b;
    else if (operation == "subtract") result = a - b;
    else if (operation == "multiply") result = a * b;
    else if (operation == "divide") {
        if (b == 0) { std::cerr << "Cannot divide by zero.\n"; return 2; }
        result = a / b;
    } else {
        std::cerr << "Unknown operation.\n";
        return 2;
    }
    if (!std::isfinite(result)) { std::cerr << "Result is outside the supported numeric range.\n"; return 2; }
    std::cout << result << '\n';
    return 0;
}
