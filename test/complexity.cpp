int compute(int value) {
    if (value < 0) {
        return 0;
    }

    for (int i = 0; i < value; ++i) {
        if (i % 2 == 0) {
            value += i;
        }
    }

    return value;
}

class Example {
public:
    int transform(int input) const {
        switch (input) {
            case 1:
                return 10;
            case 2:
                return 20;
            default:
                return input;
        }
    }
};
