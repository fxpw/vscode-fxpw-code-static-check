local function collect(items)
    local total = 0

    for _, item in ipairs(items) do
        if item.active and item.value > 0 then
            total = total + item.value
        end
    end

    return total
end

function Example.process(input)
    if input < 0 then
        return 0
    end

    while input > 0 do
        input = input - 1
    end

    return input
end

return {
    collect = collect
}
